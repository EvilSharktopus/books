const ts = require('typescript');
const fs = require('fs');

const configPath = ts.findConfigFile(
  "./",
  ts.sys.fileExists,
  "tsconfig.json"
);

if (!configPath) {
  console.log("Could not find a valid 'tsconfig.json'.");
  process.exit(1);
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedCommandLine = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  "./"
);

// Filter out the missing type packages that we know are broken locally
const options = {
    ...parsedCommandLine.options,
    skipLibCheck: true,
    noEmit: true
};

const program = ts.createProgram(parsedCommandLine.fileNames, options);
const emitResult = program.emit();

const allDiagnostics = ts
  .getPreEmitDiagnostics(program)
  .concat(emitResult.diagnostics);

let hasError = false;
allDiagnostics.forEach(diagnostic => {
  if (diagnostic.file) {
    if (diagnostic.file.fileName.includes("node_modules")) return;
    const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    hasError = true;
  } else {
    console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
  }
});

if (!hasError) console.log("No TypeScript errors found in source files.");
