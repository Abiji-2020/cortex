// Standardized interface for the code chunks that will be used for the code chunking and retrieving in semantically meaningful chunk.

export interface CodeChunk {
	filePath: string;
	language: 'python' | 'javascript' | 'typescript' | 'jsx' | 'tsx';
	chunkType: 'function' | 'class' | 'method' | 'arrow_function' | 'other';
	name: string;
	startLine: number;
	endLine: number;
	docString: string | null; // Documentation string or comment associated with the chunk
	code: string;
}
