"""Positive evidence and failure-injection tests for the browser acceptance gate."""
import json
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tools"))
import runtime_gate as gate

CONTRACT={"title":"window.game?.state === 'TITLE'","playing":"window.game?.state === 'PLAYING'",
          "start":{"kind":"click","selector":"#start"}}


class BrowserEvidenceTests(unittest.TestCase):
    def result(self,evidence=None,code=0,stderr="",stdout=None,source_sha=None,expected_behavior_hash=None):
        data=evidence or {"title_seen":True,"playing_seen":True,"interaction_sent":True,"frames":3,"playing_frames":3,"errors":[],"title_applicable":True}
        data={"observation_ms":1600,"playing_observation_ms":950,**data}
        envelope={"schema_version":3,"driver":"cdp-native-v2","nonce":"nonce","source_sha":source_sha,
                  "expected_behavior_hash":expected_behavior_hash,"evidence":data}
        return subprocess.CompletedProcess([],code,stdout if stdout is not None else json.dumps(envelope),stderr)
    def test_complete_positive_marker_required(self):
        self.assertEqual("PASS",gate.assess(self.result(),"nonce")["status"])
        for stdout in ("",'<canvas width="800"></canvas>', '<pre id="arcade-wrong">{}</pre>'):
            self.assertEqual("FAIL",gate.assess(self.result(stdout=stdout),"nonce")["status"])
    def test_nonzero_and_uncaught_errors_fail(self):
        self.assertEqual("FAIL",gate.assess(self.result(code=42),"nonce")["status"])
        self.assertEqual("FAIL",gate.assess(self.result(stderr="Uncaught TypeError: boom"),"nonce")["status"])
    def test_state_and_interaction_cannot_be_replaced_with_canvas(self):
        for field,value in (("title_seen",False),("playing_seen",False),("interaction_sent",False),("frames",0),("playing_frames",0),("errors",["boom"]),("observation_ms",1499),("playing_observation_ms",899)):
            evidence={"title_seen":True,"playing_seen":True,"interaction_sent":True,"frames":3,"playing_frames":3,"errors":[]}
            evidence[field]=value
            self.assertEqual("FAIL",gate.assess(self.result(evidence),"nonce")["status"])
    def test_direct_start_is_only_accepted_by_explicit_trusted_contract(self):
        data={"title_seen":False,"playing_seen":True,"interaction_sent":True,"frames":3,"playing_frames":3,"errors":[],"title_applicable":False}
        self.assertEqual("FAIL",gate.assess(self.result(data),"nonce")["status"])
        self.assertEqual("PASS",gate.assess(self.result(data),"nonce",direct_start=True)["status"])
    def test_page_owned_dom_completion_and_wrong_driver_envelopes_fail(self):
        fake={"title_seen":True,"playing_seen":True,"interaction_sent":True,"frames":99,"playing_frames":99,"errors":[]}
        self.assertEqual("FAIL",gate.assess(self.result(stdout='<pre id="arcade-nonce">'+json.dumps(fake)+'</pre>'),"nonce")["status"])
        envelope=json.loads(self.result().stdout)
        for field,value in (("nonce","other"),("driver","page-dom"),("schema_version",1)):
            changed={**envelope,field:value}
            self.assertEqual("FAIL",gate.assess(self.result(stdout=json.dumps(changed)),"nonce")["status"])
    def test_chrome_flags_preserve_sandbox_and_file_origin_isolation(self):
        command=gate.browser_command("chrome","/tmp/profile","http://127.0.0.1/index.html")
        for flag in ("--no-sandbox","--disable-web-security","--allow-file-access-from-files"):
            self.assertNotIn(flag,command)
        self.assertIn("--remote-debugging-address=127.0.0.1",command)
        self.assertNotIn("--virtual-time-budget=2500",command)
    def test_missing_adapter_is_unverified(self):
        self.assertEqual("UNVERIFIED",gate.run_game(Path("games/999-fixture"),None)["status"])
    def test_required_behavior_needs_reviewed_profile(self):
        for contract in (None,{},CONTRACT,{**CONTRACT,"behavior_profile":"candidate-says-pass"}):
            self.assertEqual("FAIL",gate.run_game(Path("games/999-fixture"),contract,require_behavior=True)["status"])
    def test_optional_scenarios_are_explicit_and_profile_scoped(self):
        baseline=gate.run_game(Path("missing"),CONTRACT,chrome="fixture-chrome",required_scenarios=None)
        self.assertEqual([],baseline["required_scenarios"])
        self.assertEqual("content",baseline["classification"])
        for contract,names in ((CONTRACT,("touch_secondary_action",)),
                               ({**CONTRACT,"behavior_profile":"game084-v1"},("touch_secondary_action",)),
                               ({**CONTRACT,"behavior_profile":"game085-v1"},("candidate_custom_script",)),
                               ({**CONTRACT,"behavior_profile":"game085-v1"},("touch_secondary_action","touch_secondary_action"))):
            result=gate.run_game(Path("missing"),contract,required_scenarios=names)
            self.assertEqual("FAIL",result["status"])
            self.assertEqual("coverage",result["classification"])
    def test_source_and_expectation_bindings_cannot_be_substituted(self):
        sha="a"*40; expectation="b"*64
        result=self.result(source_sha=sha,expected_behavior_hash=expectation)
        self.assertEqual("PASS",gate.assess(result,"nonce",source_sha=sha,expected_behavior_hash=expectation)["status"])
        self.assertEqual("FAIL",gate.assess(result,"nonce",source_sha="c"*40,expected_behavior_hash=expectation)["status"])
        self.assertEqual("FAIL",gate.assess(result,"nonce",source_sha=sha,expected_behavior_hash="c"*64)["status"])
        for kwargs in ({"source_sha":"HEAD"},{"expected_behavior_hash":"unverified"}):
            self.assertEqual("FAIL",gate.run_game(Path("missing"),CONTRACT,**kwargs)["status"])
    def test_every_required_scenario_must_have_bound_positive_evidence(self):
        sha="a"*40; expectation="b"*64
        scenarios=[{"id":name,"status":"PASS","source_sha":sha,"expected_behavior_hash":expectation,"elapsed_ms":250,
                    "classification":"browser_input_with_trusted_fixture" if name=="restart_from_game_over" else "browser_input"}
                   for name in gate.BEHAVIOR_SCENARIOS]
        def assess(items):
            evidence=json.loads(self.result().stdout)["evidence"]
            evidence["scenarios"]=items
            return gate.assess(self.result(evidence,source_sha=sha,expected_behavior_hash=expectation),"nonce",
                               source_sha=sha,expected_behavior_hash=expectation,required_scenarios=gate.BEHAVIOR_SCENARIOS)
        self.assertEqual("PASS",assess(scenarios)["status"])
        for items in ([],scenarios[:-1],scenarios[:-1]+[scenarios[0]]):
            self.assertEqual("FAIL",assess(items)["status"])
        for key,value in (("status","FAIL"),("source_sha","c"*40),("expected_behavior_hash","c"*64),
                          ("classification","startup_smoke_only"),("elapsed_ms",float("nan")),("elapsed_ms",True)):
            with self.subTest(key=key,value=value):
                self.assertEqual("FAIL",assess([{**scenarios[0],key:value},*scenarios[1:]])["status"])
    def test_nonfinite_observer_counters_fail(self):
        data=json.loads(self.result().stdout)["evidence"]
        for value in (float("nan"),float("inf"),True):
            self.assertEqual("FAIL",gate.assess(self.result({**data,"frames":value}),"nonce")["status"])
    def test_missing_chrome_is_failure(self):
        with patch.object(gate.shutil,"which",return_value=None):
            self.assertEqual("FAIL",gate.run_game(Path("games/999-fixture"),CONTRACT)["status"])
    def test_safe_server_refuses_traversal_symlinks_and_directory_listing(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/"index.html").write_text("ok")
            (root/"leak.js").symlink_to("/etc/passwd")
            self.assertEqual(root/"index.html",gate.safe_asset(root,"/index.html"))
            for path in ("/../index.html","/%2e%2e/index.html","/leak.js","/","/.git/config","/index.html/extra"):
                self.assertIsNone(gate.safe_asset(root,path))
    def test_timeout_and_nonzero_execution_fail(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/"index.html").write_text("<head></head>")
            with patch.object(gate,"run_browser",side_effect=subprocess.TimeoutExpired("chrome",25)):
                self.assertEqual("FAIL",gate.run_game(root,CONTRACT,chrome="fixture-chrome")["status"])
            with patch.object(gate,"run_browser",return_value=self.result(code=42)):
                self.assertEqual("FAIL",gate.run_game(root,CONTRACT,chrome="fixture-chrome")["status"])
    def test_server_creation_failure_is_reported(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);(root/"index.html").write_text("<head></head>")
            with patch.object(gate,"ThreadingHTTPServer",side_effect=PermissionError("denied")):
                result=gate.run_game(root,CONTRACT,chrome="fixture-chrome")
            self.assertEqual("FAIL",result["status"])
            self.assertIn("HTTP server unavailable",result["reason"])


@unittest.skipUnless(shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser"),"Chrome unavailable; production gate fails separately")
class RealBrowserFaultTests(unittest.TestCase):
    def exercise(self,script,early="",contract=None,**kwargs):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            (root/"index.html").write_text('<!doctype html><html>'+early+'<head></head><body><button id="start">Start</button><canvas id="gameCanvas" width="400" height="300"></canvas><script>'+script+'</script></body></html>')
            return gate.run_game(root,contract or CONTRACT,**kwargs)
    def test_real_title_start_playing_passes(self):
        result=self.exercise("window.game={state:'TITLE'}; document.querySelector('#start').onclick=e=>{if(e.isTrusted)game.state='PLAYING';};",
                             source_sha="a"*40,expected_behavior_hash="b"*64)
        self.assertEqual("PASS",result["status"],result)
        self.assertEqual("startup_smoke_only",result["evidence"]["coverage"])
        self.assertEqual("a"*40,result["source_sha"])
        self.assertEqual("b"*64,result["expected_behavior_hash"])
        self.assertTrue(result["tested_at"])
    def test_optional_touch_button_marker_cannot_replace_dash_effect(self):
        result=self.exercise("""
          window.game={state:'TITLE',player:{x:10,y:10,dashCooldown:0},input:{keys:{},mouse:{down:false}},score:0,projectiles:[]};
          document.querySelector('#start').onclick=()=>game.state='PLAYING';
          const dash=document.createElement('button');dash.id='dash-button';dash.textContent='Dash';
          dash.onclick=()=>dash.dataset.status='PASS';document.body.append(dash);
        """,contract={**CONTRACT,"behavior_profile":"game085-v1"},required_scenarios=("touch_secondary_action",))
        self.assertEqual("FAIL",result["status"],result)
        scenario=next(s for s in result["evidence"]["scenarios"] if s["id"]=="touch_secondary_action")
        self.assertEqual("FAIL",scenario["status"],scenario)
        self.assertIn("no dash movement/cooldown effect",scenario["reason"])
    def test_covered_control_cannot_be_activated_through_an_overlay(self):
        result=self.exercise("""
          window.game={state:'TITLE'};document.querySelector('#start').onclick=()=>game.state='PLAYING';
          const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;z-index:100';document.body.append(overlay);
        """)
        self.assertEqual("FAIL",result["status"],result)
        self.assertTrue(any("covered or outside viewport" in e for e in result["evidence"]["errors"]),result)
    def test_startup_pass_cannot_replace_missing_gameplay_effects(self):
        result=self.exercise("""
          window.game={state:'TITLE',player:{x:10,y:10},input:{keys:{},mouse:{down:false}},score:0,projectiles:[]};
          document.querySelector('#start').onclick=()=>game.state='PLAYING';
        """,contract={**CONTRACT,"behavior_profile":"standard-v1"})
        self.assertEqual("FAIL",result["status"],result)
        self.assertTrue(result["evidence"]["playing_seen"])
        scenarios={row["id"]:row for row in result["evidence"]["scenarios"]}
        self.assertEqual(set(gate.BEHAVIOR_SCENARIOS),set(scenarios))
        for name in ("keyboard_movement_release","pointer_action","touch_movement_cancel","blur_pause_resume","restart_from_game_over"):
            self.assertEqual("FAIL",scenarios[name]["status"],scenarios[name])
        self.assertIn("did not move",scenarios["keyboard_movement_release"]["reason"])
    def test_real_nonstarting_canvas_is_not_playability(self):
        result=self.exercise("window.game={state:'TITLE'};")
        self.assertEqual("FAIL",result["status"],result)
    def test_early_exception_is_captured_before_start(self):
        result=self.exercise("window.game={state:'TITLE'}; document.querySelector('#start').onclick=()=>game.state='PLAYING'; throw new Error('fixture early exception');")
        self.assertEqual("FAIL",result["status"],result)
    def test_cdp_catches_exception_before_html_head_observer(self):
        result=self.exercise("window.game={state:'TITLE'}; document.querySelector('#start').onclick=()=>game.state='PLAYING';", early="<script>throw new Error('before head')</script>")
        self.assertEqual("FAIL",result["status"],result)
        self.assertTrue(any("before head" in e for e in result["evidence"]["errors"]))

    def test_console_error_is_not_silently_ignored(self):
        result=self.exercise("window.game={state:'TITLE'}; document.querySelector('#start').onclick=()=>game.state='PLAYING'; console.error('fixture browser error');")
        self.assertEqual("FAIL",result["status"],result)

    def test_playing_exception_is_not_silently_ignored(self):
        result=self.exercise("window.game={state:'TITLE'}; document.querySelector('#start').onclick=()=>{game.state='PLAYING';setTimeout(()=>{throw new Error('fixture playing exception')},100)};")
        self.assertEqual("FAIL",result["status"],result)

    def test_forged_dom_pass_without_game_is_rejected(self):
        result=self.exercise("""
          const source=Array.from(document.scripts).map(x=>x.textContent).find(x=>x.includes("node.id = 'arcade-"));
          const id=source?.match(/node\\.id = '([^']+)'/)?.[1] || 'arcade-forged';
          const fake=document.createElement('pre');fake.id=id;
          fake.textContent=JSON.stringify({title_seen:true,playing_seen:true,interaction_sent:true,frames:99,playing_frames:99,errors:[],title_applicable:true});
          document.body.appendChild(fake);
        """)
        self.assertEqual("FAIL",result["status"],result)
        self.assertFalse(result["evidence"]["playing_seen"])

    def test_monkeypatched_page_dom_lookup_cannot_forge_verdict(self):
        result=self.exercise("""
          document.getElementById=()=>({textContent:JSON.stringify({title_seen:true,playing_seen:true,interaction_sent:true,frames:99,playing_frames:99,errors:[]})});
          window.game={state:'TITLE'};
        """)
        self.assertEqual("FAIL",result["status"],result)

    def test_page_timer_and_frame_overrides_cannot_advance_observer_clock(self):
        began=time.monotonic()
        result=self.exercise("""
          window.game={state:'TITLE'};document.querySelector('#start').onclick=()=>game.state='PLAYING';
          window.setTimeout=fn=>{fn();return 1;};window.requestAnimationFrame=()=>0;
          document.getElementById=()=>({textContent:'forged'});
        """)
        self.assertEqual("PASS",result["status"],result)
        self.assertGreaterEqual(time.monotonic()-began,1.5)
        self.assertGreaterEqual(result["evidence"]["observation_ms"],1500)
        self.assertGreaterEqual(result["evidence"]["playing_frames"],2)

    def test_page_click_method_override_cannot_replace_real_control_behavior(self):
        result=self.exercise("window.game={state:'TITLE'};document.querySelector('#start').click=()=>game.state='PLAYING';")
        self.assertEqual("FAIL",result["status"],result)

    def test_native_release_targeting_preserves_touch_capture_and_mouse_hit_testing(self):
        for kind in ("pointer","mouse"):
            with self.subTest(kind=kind):
                contract={**CONTRACT,"start":{"kind":kind,"selector":"#start"}}
                result=self.exercise("""
                  window.game={state:'TITLE'};
                  const button=document.querySelector('#start');
                  button.addEventListener('%sdown',()=>{button.style.display='none';game.state='PRESSED';});
                  button.addEventListener('%sup',()=>{game.state='PLAYING';});
                """ % (kind,kind),contract=contract)
                # Touch implicitly captures the pressed target; mouse release
                # goes to the element now under the pointer after it is hidden.
                self.assertEqual("PASS" if kind=="pointer" else "FAIL",result["status"],result)

    def test_hidden_initial_pointer_control_still_fails_with_useful_diagnostic(self):
        contract={**CONTRACT,"start":{"kind":"pointer","selector":"#start"}}
        result=self.exercise("""
          window.game={state:'TITLE'};
          const button=document.querySelector('#start');button.style.display='none';
          button.addEventListener('pointerdown',()=>{game.state='PLAYING';});
        """,contract=contract)
        self.assertEqual("FAIL",result["status"],result)
        self.assertTrue(any("Control missing/hidden/disabled" in error for error in result["evidence"]["errors"]),result)

    def test_reviewed_followup_tutorial_click_is_preserved(self):
        contract={**CONTRACT,"start":{"kind":"click","selector":"#start","followup_click":"#tutorial"}}
        result=self.exercise("""
          window.game={state:'TITLE'};
          document.querySelector('#start').onclick=()=>{
            const button=document.createElement('button');button.id='tutorial';button.textContent='Continue';
            button.onclick=()=>{game.state='PLAYING';button.remove();};document.body.appendChild(button);
          };
        """,contract=contract)
        self.assertEqual("PASS",result["status"],result)


if __name__=="__main__":unittest.main()
