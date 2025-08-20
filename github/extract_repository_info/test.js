// Test on any GitHub repository page
// Example: https://github.com/microsoft/vscode

await execute({
    includeFiles: true,
    includeLanguages: true,
    includeReadme: true,
    maxFiles: 20
});

// Test with minimal extraction
await execute({
    includeFiles: false,
    includeLanguages: false,
    includeReadme: false
});
