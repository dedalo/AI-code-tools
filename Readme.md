# TypeScript Documentation Generator

This project is a TypeScript documentation generator that uses OpenAI's GPT-3 to generate documentation for methods, properties, constructors, and members in TypeScript files.

## Features

- Automatically generates documentation for TypeScript files
- Updates existing documentation based on the latest code
- Supports classes, methods, properties, constructors, and enum members

## Prerequisites

- Node.js (version 12 or higher)
- An OpenAI API key

## Installation

1. Clone the repository:

```
git clone https://github.com/yourusername/typescript-documentation-generator.git
cd typescript-documentation-generator
```

2. Install dependencies:

```
npm install
```

3. Create a `.env` file in the project root directory and add your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key
```

Replace `your_openai_api_key` with your actual OpenAI API key.

4. Customize the `config.json` file as needed.

## Usage

Run the TypeScript documentation generator with the following command:

```
node tsDocumenter.js <directory>
```

Replace `<directory>` with the path to the directory containing your TypeScript files.

The generator will process all TypeScript files in the specified directory and its subdirectories, generating documentation for classes, methods, properties, constructors, and enum members.

After the generator completes its work, the updated TypeScript files will contain new or updated JSDoc comments with the generated documentation.

## License

This project is licensed under the [MIT License](LICENSE).
