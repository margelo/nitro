export const CPP_RESERVED_KEYWORDS: string[] = [
    // Control flow
    "if", "else", "switch", "case", "default", "for", "while", "do", "break", "continue", "goto", "return",
  
    // Data types
    "int", "char", "float", "double", "void", "bool", "short", "long", "signed", "unsigned",
    "wchar_t", "char8_t", "char16_t", "char32_t",
  
    // Storage class / memory management
    "auto", "register", "static", "extern", "mutable", "thread_local",
  
    // Type modifiers & casting
    "const", "volatile", "constexpr", "consteval", "constinit",
    "typename", "typedef", "decltype", "sizeof", "alignof",
  
    // Classes and inheritance
    "class", "struct", "union", "private", "protected", "public",
    "virtual", "friend", "explicit", "operator", "this", "new", "delete",
  
    // Templates
    "template", "concept", "requires",
  
    // Namespaces and linkage
    "namespace", "using", "inline",
  
    // Exceptions
    "try", "catch", "throw", "noexcept",
  
    // Boolean and values
    "true", "false", "nullptr",
  
    // Miscellaneous
    "enum", "static_assert", "export", "import",
    "co_await", "co_return", "co_yield",
  
    // Alternative tokens (operator keywords)
    "and", "and_eq", "bitand", "bitor", "compl", "not", "not_eq",
    "or", "or_eq", "xor", "xor_eq"
  ];
  