/**
 * This is a TypeScript documentation generator that uses OpenAI's GPT-3 to generate documentation for
 * methods, properties, constructors, and members in TypeScript files.
 * @param codigo - The `codigo` parameter is a string representing the code that needs to be
 * documented.
 * @param [retries] - The number of times the OpenAI API request will be retried in case of failure.
 * @returns It is not clear what is being returned as it depends on the specific function being called
 * and its implementation. Some functions may return a string, while others may return null or
 * undefined.
 */
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

/**
 * This function sends a prompt to the OpenAI API and returns the response message.
 * @param codigo - The code that the user wants to execute or get help with.
 * @param [language=en] - The language parameter is a string that specifies the language of the prompt
 * being sent to the OpenAI API. It has a default value of 'en' (English) but can be set to any
 * language supported by the API.
 * @param [retries] - The number of times the function will retry the API request in case of failure.
 * It is set to the value specified in the `config.openAiConfig.retries` variable.
 * @returns a string that represents the response from the OpenAI API. If there is an error with the
 * API request, it will return null.
 */
async function createDoc(codigo, language = 'en', retries = config.openAiConfig.retries) {
  const beforeCode = config.prompt[language].beforeCode;
  const afterCode = config.prompt[language].afterCode;
  const systemContent = config.prompt[language].systemContent;
  
  let userMessage = beforeCode + codigo + afterCode;
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
 * The function extracts the content of a JavaScript multiline comment and returns it as a string.
 * @param text - a string that may contain a JavaScript jsdoc comment
 * @returns the content of a comment in a given text string, without the asterisks and white spaces. If
 * no comment is found, it returns null.
 */
function extractComment(text) {
  // Search for the start index of the comment
  const commentStart = text.indexOf('/**');
  if (commentStart === -1) {
    return null; // Comment not found
  }
  
  // Search for the end index of the comment
  const commentEnd = text.indexOf('*/', commentStart);
  if (commentEnd === -1) {
    return null; // End of comment not found
  }
  
  // Get the content of the comment (without the asterisks)
  const commentContent = text
    .substring(commentStart + 3, commentEnd)
    .split('\n') // Split into lines
    .map(line => line.trim().replace(/^\* ?/, '')) // Remove asterisks and white spaces
    .join('\n') // Rejoin into a single string
  
  return commentContent;
}



/**
 * This function updates or adds documentation to a JavaScript method based on the provided
 * documentation.
 * @param method - The method that needs to be documented
 * @param documentation - The documentation string that will be added or updated for a given method.
 */
async function updateDoc(method, documentation) {
  const comment = `\n${extractComment(documentation)}`;

  const jsDocs = method.getJsDocs();
  if (jsDocs.length > 0) {
    console.log(`\nUpdating documentation for component in file ${method.getSourceFile().getFilePath()}:`);
    console.log(comment);
    jsDocs[0].replaceWithText(comment);
  } else {
    console.log(`\nAdding documentation for component in file ${method.getSourceFile().getFilePath()}:`);
    console.log(comment);
    await method.addJsDoc(comment);
  }
}



/* Uses the TypeScript compiler API to automatically generate
documentation for TypeScript code. It takes a directory path as an argument and processes all
TypeScript and TypeScript React files in that directory. For each file, it iterates over all the
classes, properties, methods, constructors, and enum members, and checks if they have any existing
documentation. If not, it generates documentation for them using an external API and updates the
code with the new documentation. Finally, it saves the changes to the project. */
(async () => {
  const project = new Project();
  const dirPath = process.argv[2]; 
  const language = process.argv[3] || 'en';

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
        const documentation = method.getJsDocs().map(jsdoc => jsdoc.getText()).join('\n');
        if (!documentation || /^\s*$/.test(documentation)) {
          const code = method.getText();
          if (code.length > config.minLength) { // Validate if the method has more than minLength
            const newDocumentation = await createDoc(code, language);
            if (newDocumentation) {
              await updateDoc(method, newDocumentation);
            }
          } else {
            console.warn(`The method '${method.getName()}' in file ${method.getSourceFile().getFilePath()} is too short to be documented`);
          }
        }
      }

      // Iterate over all the properties in the classes
      const properties = classObj.getProperties();
      for (const property of properties) {
        const documentation = property.getJsDocs().map(jsdoc => jsdoc.getText()).join('\n');
        if (!documentation || /^\s*$/.test(documentation)) {
          const code = property.getText();
          if (code.length > config.minLength) { // Validate if the property has more than minLength
            const newDocumentation = await createDoc(code, language);
            if (newDocumentation) {
              await updateDoc(property, newDocumentation);
            }
          } else {
            console.warn(`The property '${property.getName()}' in file ${property.getSourceFile().getFilePath()} is too short to be documented`);
          }
        }
      }

      // Iterate over all the constructors in the classes
      const constructors = classObj.getConstructors();
      for (const constructor of constructors) {
        const documentation = constructor.getJsDocs().map(jsdoc => jsdoc.getText()).join('\n');
        if (!documentation || /^\s*$/.test(documentation)) {
          const code = constructor.getText();
          if (code.length > config.minLength) { // Validate if the constructor has more than minLength
            const newDocumentation = await createDoc(code, language);
            if (newDocumentation) {
              await updateDoc(constructor, newDocumentation);
            }
          } else {
            console.warn(`The constructor in file ${constructor.getSourceFile().getFilePath()} is too short to be documented`);
          }
        }
      }
    }

    // Iterate over all the members in the enums
    const enums = file.getEnums();
    for (const enumObj of enums) {
      const members = enumObj.getMembers();
      for (const member of members) {
        const documentation = member.getJsDocs().map(jsdoc => jsdoc.getText()).join('\n');
        if (!documentation || /^\s*$/.test(documentation)) {
          const code = member.getText();
          if (code.length > config.minLength) { // Validate if the member has more than minLength
            const newDocumentation = await createDoc(code, language);
            if (newDocumentation) {
              await updateDoc(member, newDocumentation);
            }
          } else {
            console.warn(`The member '${member.getName()}' in file ${member.getSourceFile().getFilePath()} is too short to be documented`);
          }
        }
      }
    }
    
    console.log(`Saving changes in ${file.getFilePath()}`);
    project.saveSync();
  }
})();

