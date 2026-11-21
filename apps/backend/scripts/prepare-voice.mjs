import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const directory = fileURLToPath(new URL("../.voice-runtime/", import.meta.url));
const python = path.join(directory, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const version = "7.3.1";
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error || result.status !== 0) throw Error(`Voice setup failed running ${command}. Install Python 3 with venv support or uv, then rerun npm run voice:prepare.`);
}
const hasUv = spawnSync("uv", ["--version"], {stdio:"ignore"}).status === 0;
if (!existsSync(python)) {
  if (hasUv) run("uv", ["venv", directory, "--python", "3.12"]);
  else run(process.platform === "win32" ? "py" : "python3", ["-m", "venv", directory]);
}
if (spawnSync(python, ["-c", `from importlib.metadata import version; assert version("edge-tts") == "${version}"`], {stdio:"ignore"}).status !== 0) {
  if (hasUv) run("uv", ["pip", "install", "--python", python, `edge-tts==${version}`]);
  else run(python, ["-m", "pip", "install", `edge-tts==${version}`]);
}
copyFileSync(new URL("../src/scripts/stream_tts.py", import.meta.url), path.join(directory, "stream_tts.py"));
