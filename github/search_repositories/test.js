await execute({
    query: "javascript framework",
    language: "javascript",
    sort: "stars",
    maxResults: 5
});

// Test from search page
// https://github.com/search?q=react&type=repositories

await execute({
    query: "react",
    maxResults: 10
});
