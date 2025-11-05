// Test how Make.com returns values

// Option 1: Simple global variable
var result1 = { test: "option1", value: 123 };

// Option 2: Last expression
var result2 = (function() {
    return { test: "option2", value: 456 };
})();

// Option 3: this assignment
this.result3 = { test: "option3", value: 789 };

// Option 4: Direct return (won't work outside function)
// return { test: "option4" };

console.log("result1:", JSON.stringify(result1));
console.log("result2:", JSON.stringify(result2));
console.log("result3:", JSON.stringify(this.result3));

// What does Make.com return?
result2;
