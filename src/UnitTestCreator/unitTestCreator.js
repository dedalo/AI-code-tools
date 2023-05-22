require('dotenv').config();
const fs = require('fs');
const { Project, SyntaxKind } = require('ts-morph');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  console.log('The OPENAI_API_KEY environment variable is not set. Please create a .env file with the following content:');
  console.log('OPENAI_API_KEY=your_openai_api_key');
  console.log('Replace "your_openai_api_key" with your actual OpenAI API key.');
  process.exit(1);
}

const openai = new OpenAIApi(configuration);

async function generateTestFileContent(className,funcName,testFileName,clasCode, retries = config.openAiConfig.retries) {
  const beforeCode = config.prompt.beforeCode.replace('{className}', className);
  const afterCode = config.prompt.afterCode.replace('{methodName}', funcName).replace('{testFileName}', testFileName);
  const systemContent = config.prompt.systemContent;
  
  let userMessage = beforeCode + removeComments(clasCode) + afterCode;
  const messages = [
    { role: 'system', content: systemContent },
    { role: 'user', content: userMessage },
  ];

  try {
    console.log(`Sending prompt to the API: ${JSON.stringify(messages)}`);
    const response = await openai.createChatCompletion({
      model: config.openAiConfig.model,
      messages,
      max_tokens: config.openAiConfig.max_tokens,
      n: config.openAiConfig.n,
      stop: config.openAiConfig.stop,
      temperature: config.openAiConfig.temperature,
      top_p: config.openAiConfig.top_p
    });
    const message = response.data.choices[0].message;
    console.log('Response from OpenAI API:', message.content);
    if (message && message.content) {
      return message.content.trim();
    } else {
      throw new Error(`Unexpected message format: ${JSON.stringify(message)}`);
    }
  } catch (error) {
    console.error(`Error with OpenAI API request: ${error.message}`);
    return null;
  }
}

function removeComments(code) {
  const singleLineComment = /\/\/.*/g;
  const multiLineComment = /\/\*[\s\S]*?\*\//g;
  return code.replace(singleLineComment, '').replace(multiLineComment, '');
}


/**
 * This function ensures that a directory exists for a given file path.
 * @param filePath - The path of the file for which we want to ensure the existence of its directory.
 * @returns The function does not have a return statement for the case where the directory already
 * exists, so it returns undefined.
 */
function ensureDirectoryExistence(filePath) {
  const dir = path.dirname(filePath);
  if (fs.existsSync(dir)) {
    return true;
  }
  ensureDirectoryExistence(path.dirname(dir));
  fs.mkdirSync(dir);
}

/**
 * Checks if a file exists at the given file path.
 *
 * @param {string} testFilePath - The path of the file to check.
 * @return {boolean} Returns true if the file exists, false otherwise.
 */
function testFileExists(testFilePath) {
  return fs.existsSync(testFilePath);
}


/**
 * This function creates a unit test file for the given function with the provided test file content
 * @param filePath - The file path where the unit test file will be created
 * @param testFileContent - The content of the unit test file
 */
function createUnitTestFile(filePath, testFileContent) {
  ensureDirectoryExistence(filePath); 
  fs.writeFileSync(filePath, testFileContent, 'utf-8');
  console.log(`Created unit test file: ${filePath}`);
}



(async () => {
  const project = new Project();
  const dirPath = process.argv[2]; 

  if (!dirPath) {
    console.log('Use: node unitTestCreator.js <directory>');
    process.exit(1);
  }

  const files = project.addSourceFilesAtPaths(`${dirPath}/**/*.{ts,tsx}`);

  for (const file of files) {
    console.log(`Processing file ${file.getFilePath()}`);

    // Iterate over all the methods in the classes
    const classes = file.getClasses();
    for (const classObj of classes) {
      const clasCode = classObj.getText();
      const methods = classObj.getMethods();
      for (const method of methods) {
        const methodName = method.getName();
        if (methodName) {
          const methodCode = method.getText();
          if (methodCode.length > config.minLength) { 
            const testFileName = `${path.basename(file.getFilePath(), '.ts')}.${methodName}.spec.ts`;
            const testFilePath = path.join(path.dirname(file.getFilePath()), testFileName);

            if (!testFileExists(testFilePath)) {
              const testFileContent = await generateTestFileContent(classObj.getName(),methodName,testFileName,clasCode);
              createUnitTestFile(testFilePath, testFileContent);
            } else {
              console.log(`Unit test file already exists: ${testFilePath}`);
            }
          }
        }
      }
    }
/*
    // Iterate over all the functions in the file
    const functions = file.getFunctions();
    for (const func of functions) {
      const funcName = func.getName();
      if (funcName) {
        const code = func.getText();
        if (code.length > config.minLength) { 
          const testFileContent = await generateTestFileContent(funcName,code);
          const testFileName = `${path.basename(file.getFilePath(), '.ts')}.${funcName}.spec.ts`;
          const testFilePath = path.join(path.dirname(file.getFilePath()), '__tests__', testFileName);
          createUnitTestFile(testFilePath, testFileContent);
        }
      }
    }
*/

    
    console.log(`Saving changes in ${file.getFilePath()}`);
    project.saveSync();
  }
})();

