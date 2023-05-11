require('dotenv').config();
const fs = require('fs');
const { Project, SyntaxKind } = require('ts-morph');
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

async function generateTestFileContent(funcName,code, retries = config.openAiConfig.retries) {
  const beforeCode = config.prompt.beforeCode;
  const afterCode = config.prompt.afterCode;
  const systemContent = config.prompt.systemContent;
  
  let userMessage = beforeCode + code + afterCode;
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

/**
 * This function creates a unit test file for the given function with the provided test file content
 * @param filePath - The file path where the unit test file will be created
 * @param testFileContent - The content of the unit test file
 */
function createUnitTestFile(filePath, testFileContent) {
  fs.writeFileSync(filePath, testFileContent, 'utf-8');
  console.log(`Created unit test file: ${filePath}`);
}



(async () => {
  const project = new Project();
  const dirPath = process.argv[2]; 

  if (!dirPath) {
    console.log('Use: node tsDocumenter.js <directory>');
    process.exit(1);
  }

  const files = project.addSourceFilesAtPaths(`${dirPath}/**/*.{ts,tsx}`);

  for (const file of files) {
    console.log(`Processing file ${file.getFilePath()}`);

    // Iterate over all the methods in the classes
    const classes = file.getClasses();
    for (const classObj of classes) {
      const methods = classObj.getMethods();
      for (const method of methods) {
        const methodName = method.getName();
        if (methodName) {
          const code = method.getText();
          if (code.length > config.minLength) { 
            const testFileContent = generateTestFileContent(methodname,code);
            const testFileName = `${path.basename(file.getFilePath(), '.ts')}.${methodName}.spec.ts`;
            const testFilePath = path.join(path.dirname(file.getFilePath()), '__tests__', testFileName);
            createUnitTestFile(testFilePath, testFileContent);
          }
        }
      }
    }

    // Iterate over all the functions in the file
    const functions = file.getFunctions();
    for (const func of functions) {
      const funcName = func.getName();
      if (funcName) {
        const code = func.getText();
        if (code.length > config.minLength) { 
          const testFileContent = generateTestFileContent(funcName,code);
          const testFileName = `${path.basename(file.getFilePath(), '.ts')}.${funcName}.spec.ts`;
          const testFilePath = path.join(path.dirname(file.getFilePath()), '__tests__', testFileName);
          createUnitTestFile(testFilePath, testFileContent);
        }
      }
    }


    
    console.log(`Saving changes in ${file.getFilePath()}`);
    project.saveSync();
  }
})();

