// Test on any Google Docs document
// Example: https://docs.google.com/document/d/YOUR_DOC_ID/edit

await execute({
    includeFormatting: true,
    includeComments: true,
    includeStructure: true,
    maxBlocks: 100
});

// Test with minimal extraction
await execute({
    includeFormatting: false,
    includeComments: false,
    includeStructure: false,
    maxBlocks: 50
});
