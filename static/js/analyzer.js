import { dotnet } from './analyzer/_framework/dotnet.js';

const { getAssemblyExports, getConfig } = await dotnet.create();
const config = getConfig();

const exports = await getAssemblyExports(config.mainAssemblyName);

export function analyzeMod(bytes) {
    return exports.HarmonyPatchAnalyzer.Wasm.Program.AnalyzeMod(bytes);
}