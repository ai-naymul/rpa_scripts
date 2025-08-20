// Test on any public Airtable base
// Example: https://airtable.com/shrXXXXXXXXX (public shared base)

await execute({
    maxRecords: 20,
    includeFieldTypes: true,
    includeFormattedValues: true,
    waitForLoad: 5000
});

// Test with minimal extraction
await execute({
    maxRecords: 50,
    includeFieldTypes: false,
    includeFormattedValues: false,
    waitForLoad: 3000
});
