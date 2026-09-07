solutions = [
  { "name": "pdfium",
    "url":  "https://github.com/embedpdf/runtime.git",
    "deps_file": "DEPS",
    "managed": False,
    "custom_vars": {
      "checkout_configuration": "small",
    },
  },
]
target_os = [ "emscripten" ]
