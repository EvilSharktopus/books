import fs from "fs";

let code = fs.readFileSync("components/RatingForm.tsx", "utf-8");
code = code.replace(/\r\n/g, "\n"); // Normalize line endings to LF

// 1. Add language to EMPTY_VALUES
code = code.replace(
  `  authorCountry: "",\n};`,
  `  authorCountry: "",\n  language: "English",\n};`
);

// 2. Add hiddenFields state
code = code.replace(
  `  const [storedOptions, setStoredOptions] = useLocalStorage(SOURCE_OPTIONS_KEY);`,
  `  const [hiddenFields, setHiddenFields] = useLocalStorage("bookRatings.hiddenFields");
  const hiddenArr = useMemo<string[]>(() => {
    if (!hiddenFields) return [];
    try { return JSON.parse(hiddenFields); } catch { return []; }
  }, [hiddenFields]);
  const isHidden = (field: string) => hiddenArr.includes(field);
  const hideField = (field: string) => setHiddenFields(JSON.stringify([...hiddenArr, field]));
  const restoreFields = () => setHiddenFields("[]");

  // Editable "Where'd you hear about it?" options (persisted per browser)
  const [storedOptions, setStoredOptions] = useLocalStorage(SOURCE_OPTIONS_KEY);`
);

// 3. Add language field and hide authorCountry
code = code.replace(
  `        <div className="flex flex-col gap-1">\n          <label htmlFor="authorCountry" className="text-sm font-semibold text-gray-700">\n            Author country{" "}\n            <span className="font-normal text-gray-500">(optional)</span>\n          </label>\n          <input`,
  `        {!isHidden("language") && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-gray-700">
              Language <span className="font-normal text-gray-500">(optional)</span>
              <button type="button" onClick={() => hideField('language')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">✕ hide</button>
            </span>
            <div className="flex gap-2" role="radiogroup">
              {["English", "Translated"].map((lang) => (
                <button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={values.language === lang}
                  onClick={() => setField("language", lang)}
                  className={\`px-4 py-2 rounded-lg text-sm font-medium border transition-colors \${
                    values.language === lang
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "bg-white border-gray-300 text-gray-700 hover:border-blue-400"
                  }\`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isHidden("authorCountry") && (
          <div className="flex flex-col gap-1">
            <label htmlFor="authorCountry" className="text-sm font-semibold text-gray-700">
              Author country{" "}
              <span className="font-normal text-gray-500">(optional)</span>
              <button type="button" onClick={() => hideField('authorCountry')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">✕ hide</button>
            </label>
            <input`
);

code = code.replace(
  `            placeholder="e.g. Canada"\n            className={INPUT_CLASSES}\n          />\n        </div>\n      </div>`,
  `            placeholder="e.g. Canada"
            className={INPUT_CLASSES}
          />
        </div>
        )}
      </div>`
);

// 4. Year, Pages, Type
code = code.replace(
  `      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">\n        <div className="flex flex-col gap-1">\n          <label htmlFor="year" className="text-sm font-semibold text-gray-700">\n            Year <span className="font-normal text-gray-500">(optional)</span>\n          </label>\n          <input`,
  `      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
        {!isHidden("year") && (
        <div className="flex flex-col gap-1">
          <label htmlFor="year" className="text-sm font-semibold text-gray-700">
            Year <span className="font-normal text-gray-500">(optional)</span>
            <button type="button" onClick={() => hideField('year')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">✕ hide</button>
          </label>
          <input`
);
code = code.replace(
  `            placeholder="e.g. 2023"\n            className={INPUT_CLASSES}\n          />\n        </div>\n        <div className="flex flex-col gap-1">\n          <label htmlFor="pages" className="text-sm font-semibold text-gray-700">\n            Pages <span className="font-normal text-gray-500">(optional)</span>\n          </label>\n          <input`,
  `            placeholder="e.g. 2023"
            className={INPUT_CLASSES}
          />
        </div>
        )}
        {!isHidden("pages") && (
        <div className="flex flex-col gap-1">
          <label htmlFor="pages" className="text-sm font-semibold text-gray-700">
            Pages <span className="font-normal text-gray-500">(optional)</span>
            <button type="button" onClick={() => hideField('pages')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">✕ hide</button>
          </label>
          <input`
);
code = code.replace(
  `            placeholder="e.g. 384"\n            className={INPUT_CLASSES}\n          />\n        </div>\n        <div className="col-span-2 flex flex-col gap-1.5">\n          <span className="text-sm font-semibold text-gray-700">\n            Type <span className="font-normal text-gray-500">(optional)</span>\n          </span>\n          <div className="flex gap-2" role="radiogroup" aria-label="Type">`,
  `            placeholder="e.g. 384"
            className={INPUT_CLASSES}
          />
        </div>
        )}
        {!isHidden("type") && (
        <div className="col-span-2 flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-gray-700">
            Type <span className="font-normal text-gray-500">(optional)</span>
            <button type="button" onClick={() => hideField('type')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">✕ hide</button>
          </span>
          <div className="flex gap-2" role="radiogroup" aria-label="Type">`
);
code = code.replace(
  `              </button>\n            ))}\n          </div>\n        </div>\n      </div>`,
  `              </button>
            ))}
          </div>
        </div>
        )}
      </div>`
);

// 5. Notes
code = code.replace(
  `      <div className="flex flex-col gap-1">\n        <label htmlFor="notes" className="text-sm font-semibold text-gray-700">\n          Notes <span className="font-normal text-gray-500">(optional)</span>\n        </label>\n        <textarea`,
  `      {!isHidden("notes") && (
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-semibold text-gray-700">
          Notes <span className="font-normal text-gray-500">(optional)</span>
          <button type="button" onClick={() => hideField('notes')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">✕ hide</button>
        </label>
        <textarea`
);
code = code.replace(
  `          placeholder="What did you think of it?"\n          className={\`\${INPUT_CLASSES} resize-none\`}\n        />\n      </div>\n\n      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 select-none">`,
  `          placeholder="What did you think of it?"
          className={\`\${INPUT_CLASSES} resize-none\`}
        />
      </div>
      )}

      {!isHidden("cried") && (
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 select-none">`
);

// 6. Cried & Source
code = code.replace(
  `          className="w-4 h-4 accent-blue-600"\n        />\n        Cried while reading\n      </label>\n\n      <div className="flex flex-col gap-1">\n        <label htmlFor="source" className="text-sm font-semibold text-gray-700">\n          Where&apos;d you hear about it?{" "}\n          <span className="font-normal text-gray-500">(optional)</span>\n        </label>`,
  `          className="w-4 h-4 accent-blue-600"
        />
        Cried while reading
        <button type="button" onClick={() => hideField('cried')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">✕ hide</button>
      </label>
      )}

      {!isHidden("source") && (
      <div className="flex flex-col gap-1">
        <label htmlFor="source" className="text-sm font-semibold text-gray-700">
          Where&apos;d you hear about it?{" "}
          <span className="font-normal text-gray-500">(optional)</span>
          <button type="button" onClick={() => hideField('source')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-normal">✕ hide</button>
        </label>`
);

// 7. End of Source and submit button
code = code.replace(
  `          </div>\n        )}\n      </div>\n\n      <button\n        type="submit"`,
  `          </div>
        )}
      </div>
      )}

      {hiddenArr.length > 0 && (
        <div className="text-center pt-2">
          <button type="button" onClick={restoreFields} className="text-sm font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2">
            Restore hidden questions
          </button>
        </div>
      )}

      <button
        type="submit"`
);

fs.writeFileSync("components/RatingForm.tsx", code);
console.log("RatingForm.tsx updated successfully!");
