import * as fs from 'fs';
import * as path from 'path';
import {CodeChunk} from '../types/codechunk.js';

type Language = CodeChunk['language'];

export class CodeParser {
	/**
	 * Parses code files and extracts meaningful chunks.
	 */
	private static readonly SUPPORTED_EXTENSIONS: Record<string, Language> = {
		'.py': 'python',
		'.js': 'javascript',
		'.ts': 'typescript',
		'.jsx': 'jsx',
		'.tsx': 'tsx',
	};

	/**
	 * Scans a directory and parses all supported files.
	 * @param directory The path to the directory to scan.
	 * @returns A promise that resolves to a list of all found code chunks.
	 */
	public async parseDirectory(directory: string): Promise<CodeChunk[]> {
		let allChunks: CodeChunk[] = [];
		const files = await this.getAllFiles(directory);

		for (const filePath of files) {
			const extension = path.extname(filePath);
			const language = CodeParser.SUPPORTED_EXTENSIONS[extension];
			if (language) {
				try {
					const content = await fs.promises.readFile(filePath, 'utf-8');
					let chunks: CodeChunk[] = [];
					if (language === 'python') {
						chunks = this._parsePython(content, filePath);
					} else {
						chunks = this._parseJavaScriptTypeScript(
							content,
							filePath,
							language,
						);
					}
					allChunks = allChunks.concat(chunks);
				} catch (e) {
					throw new Error(`Failed to read or parse file ${filePath}: ${e}`);
				}
			}
		}
		return allChunks;
	}

	/**
	 * Recursively gets all file paths within a directory.
	 * @param dirPath The directory to scan.
	 * @param arrayOfFiles An array to accumulate file paths.
	 * @returns A promise that resolves to an array of file paths.
	 */
	private async getAllFiles(
		dirPath: string,
		arrayOfFiles: string[] = [],
	): Promise<string[]> {
		const files = await fs.promises.readdir(dirPath);

		for (const file of files) {
			const fullPath = path.join(dirPath, file);
			const stat = await fs.promises.stat(fullPath);
			if (stat.isDirectory()) {
				await this.getAllFiles(fullPath, arrayOfFiles);
			} else {
				arrayOfFiles.push(fullPath);
			}
		}
		return arrayOfFiles;
	}

	/**
	 * Parses Python code using regular expressions.
	 * Note: This is a simplified parser. For full accuracy, a dedicated Python AST parser
	 * library (e.g., one built with tree-sitter) would be more robust.
	 */
	private _parsePython(content: string, filePath: string): CodeChunk[] {
		const chunks: CodeChunk[] = [];
		const lines = content.split('\n');

		// Regex for class and function definitions.
		const pattern = /^(async\s+def|def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm;
		let match;

		while ((match = pattern.exec(content)) !== null) {
			const typeKeyword = match[1];
			const name = match[2] || 'unknown';
			const startLine = content.substring(0, match.index).split('\n').length;

			const {endLine, blockCode, docstring} = this._findPythonBlockEnd(
				lines,
				startLine,
			);

			const isMethod = this._isPythonMethod(lines, startLine - 1);

			let chunkType: CodeChunk['chunkType'] = 'other';
			if (typeKeyword === 'class') {
				chunkType = 'class';
			} else if (isMethod) {
				chunkType = 'method';
			} else {
				chunkType = 'function';
			}

			chunks.push({
				filePath,
				language: 'python',
				chunkType,
				name,
				startLine,
				endLine,
				docString: docstring,
				code: blockCode,
			});
		}
		return chunks;
	}

	/**
	 * Determines if a Python function is a method based on indentation.
	 */
	private _isPythonMethod(lines: string[], startLineIndex: number): boolean {
		if (startLineIndex === 0) return false;

		const line = lines[startLineIndex] || '';
		const indent = line.length - line.trimStart().length;
		if (indent === 0) return false;

		for (let i = startLineIndex - 1; i >= 0; i--) {
			const prevLine = lines[i] || '';
			const prevIndent = prevLine.length - prevLine.trimStart().length;
			if (prevLine.trim().startsWith('class ') && prevIndent < indent) {
				return true;
			}
			if (prevIndent < indent) {
				return false;
			}
		}
		return false;
	}

	/**
	 * Finds the end of a Python code block by tracking indentation.
	 */
	private _findPythonBlockEnd(lines: string[], startLine: number) {
		const startLineIndex = startLine - 1;
		const initialIndent = lines[startLineIndex]?.match(/^\s*/)?.[0].length ?? 0;
		let endLine = startLine;
		let docstring: string | null = null;

		// Check for docstring
		const firstLineAfterDef = lines[startLineIndex + 1]?.trim() || '';
		if (
			firstLineAfterDef.startsWith('"""') ||
			firstLineAfterDef.startsWith("'''")
		) {
			const quoteChar = firstLineAfterDef.substring(0, 3);
			let docstringEndLine = startLineIndex + 1;
			let foundEnd = false;
			for (let i = startLineIndex + 1; i < lines.length; i++) {
				const line = lines[i];
				if (typeof line === 'string' && line?.includes(quoteChar)) {
					docstringEndLine = i;
					foundEnd = true;
					break;
				}
			}
			if (foundEnd) {
				docstring = lines
					.slice(startLineIndex + 1, docstringEndLine + 1)
					.join('\n')
					.replace(new RegExp(quoteChar, 'g'), '')
					.trim();
			}
		}

		for (let i = startLineIndex + 1; i < lines.length; i++) {
			const line = lines[i];
			if (!line || line.trim() === '') continue; // Skip empty or undefined lines

			const currentIndent = line.length - line.trimStart().length;
			if (currentIndent <= initialIndent) {
				break;
			}
			endLine = i + 1;
		}

		const blockCode = lines.slice(startLineIndex, endLine).join('\n');
		return {endLine, blockCode, docstring};
	}

	/**
	 * Parses JS/TS/JSX/TSX files using regular expressions.
	 */
	private _parseJavaScriptTypeScript(
		content: string,
		filePath: string,
		language: Language,
	): CodeChunk[] {
		const chunks: CodeChunk[] = [];
		const lines = content.split('\n');

		// Regex for functions, arrow functions, and classes. It also captures JSDoc blocks.
		const pattern =
			/(?:\/\*\*[\s\S]*?\*\/[\s\n]*)?(?:export\s+)?(async\s+)?(function\*?|class)\s+([a-zA-Z0-9_]+)|(?:export\s+)?(const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async)?\s*\(.*?\)\s*=>/g;

		let match;
		while ((match = pattern.exec(content)) !== null) {
			const startPos = match.index;
			const startLine = content.substring(0, startPos).split('\n').length;

			const {endLine, blockCode, docstring} = this._findJSBlockEnd(
				content,
				startPos,
				lines,
			);

			const name = match[3] || match[5] || 'unknown';
			let chunkType: CodeChunk['chunkType'] = 'other';
			if (match[2] === 'class') {
				chunkType = 'class';
			} else if (match[2]?.includes('function')) {
				chunkType = 'function'; // More complex logic needed for methods
			} else if (match[0].includes('=>')) {
				chunkType = 'arrow_function';
			}

			chunks.push({
				filePath,
				language,
				chunkType,
				name,
				startLine,
				endLine,
				docString: docstring,
				code: blockCode,
			});
		}
		return chunks;
	}

	/**
	 * Finds the end of a JS/TS code block by matching braces.
	 */
	private _findJSBlockEnd(
		content: string,
		startPos: number,
		lines: string[],
	): {endLine: number; blockCode: string; docstring: string | null} {
		let openBraces = 0;
		let inString: false | string = false;
		let escape = false;
		let docstring: string | null = null;

		const docMatch = content
			.substring(0, startPos)
			.match(/\/\*\*([\s\S]*?)\*\/$/);
		if (docMatch && typeof docMatch[1] === 'string') {
			docstring = docMatch[1]
				.split('\n')
				.map(line => line.trim().replace(/^\* ?/, ''))
				.join('\n')
				.trim();
		}

		let firstBraceFound = false;
		let codeBlockStartLineIndex =
			content.substring(0, startPos).split('\n').length - 1;

		let i = startPos;
		// Find the opening brace to start counting
		while (i < content.length && content[i] !== '{') {
			i++;
		}

		if (i < content.length) {
			// Found '{'
			codeBlockStartLineIndex = content.substring(0, i).split('\n').length - 1;
		}

		for (; i < content.length; i++) {
			const char = content[i];

			if (inString) {
				if (char === inString && !escape) {
					inString = false;
				} else {
					escape = char === '\\' && !escape;
				}
			} else {
				if (char === '"' || char === "'" || char === '`') {
					inString = char;
					escape = false;
				} else if (char === '{') {
					openBraces++;
					firstBraceFound = true;
				} else if (char === '}') {
					openBraces--;
				}
			}

			if (firstBraceFound && openBraces === 0) {
				const endLine = content.substring(0, i + 1).split('\n').length;
				const blockCode = lines
					.slice(codeBlockStartLineIndex, endLine)
					.join('\n');
				return {endLine, blockCode, docstring};
			}
		}

		// Fallback if no closing brace is found (e.g., for one-liner arrow functions)
		const endLine = lines.length;
		const blockCode = lines.slice(codeBlockStartLineIndex).join('\n');
		return {endLine, blockCode, docstring};
	}
}
