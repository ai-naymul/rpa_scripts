// Test on any LinkedIn company page
// Example: https://www.linkedin.com/company/microsoft

await execute({
    includeEmployees: true,
    includeUpdates: true,
    maxUpdates: 5,
    waitForLoad: 5000
});

// Test with employee info (limited for privacy)
await execute({
    includeEmployees: true,
    includeUpdates: true,
    maxUpdates: 3,
    waitForLoad: 3000
});
