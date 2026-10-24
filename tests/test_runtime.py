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
    def result(self,evidence=None,code=0,stderr="",stdout=None):
        data=evidence or {"title_seen":True,"playing_seen":True,"interaction_sent":True,"frames":3,"playing_frames":3,"errors":[],"title_applicable":True}
        data={"observation_ms":1600,"playing_observation_ms":950,**data}
        envelope={"schema_version":2,"driver":"cdp-isolated-v1","nonce":"nonce","evidence":data}
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


@unittest.skipUnless(shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser"),"Chrome unavailable; production gate fails separately")
class RealBrowserFaultTests(unittest.TestCase):
    def exercise(self,script,early="",contract=None):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            (root/"index.html").write_text('<!doctype html><html>'+early+'<head></head><body><button id="start">Start</button><canvas width="40" height="40"></canvas><script>'+script+'</script></body></html>')
            return gate.run_game(root,contract or CONTRACT)
    def test_real_title_start_playing_passes(self):
        result=self.exercise("window.game={state:'TITLE'}; document.querySelector('#start').onclick=()=>game.state='PLAYING';")
        self.assertEqual("PASS",result["status"],result)
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
