// Example: https://www.linkedin.com/in/username

await execute({
    includeExperience: true,
    includeEducation: true,
    includeSkills: false,
    maxExperience: 5,
    waitForLoad: 5000
});

// Test with all sections
await execute({
    includeExperience: true,
    includeEducation: true,
    includeSkills: true,
    maxExperience: 10,
    waitForLoad: 3000
});