await execute({
    includeTables: true,
    includeImages: true,
    includeComments: true,
    maxBlocks: 100,
    waitForLoad: 7000
});

// Test with minimal extraction
await execute({
    includeTables: false,
    includeImages: false,
    includeComments: false,
    maxBlocks: 50,
    waitForLoad: 3000
});
