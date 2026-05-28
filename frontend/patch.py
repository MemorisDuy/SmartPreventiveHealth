import sys

with open('src/pages/RiskAssessmentPage.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

if 'import { XAI_Mock' not in text:
    text = text.replace("import React,", "import React,\nimport { XAI_Mock } from '../components/XAIMock';\n")
    if "import React," not in text:
      text = "import { XAI_Mock } from '../components/XAIMock';\n" + text

old_str = """<div className="mt-8 bg-white/40 p-5 rounded-xl border border-white/20 backdrop-blur-sm">
            <p className="text-lg font-medium leading-relaxed">{result.message}</p>
          </div>"""
new_str = old_str + "\n          <XAI_Mock result={result} />"

if old_str in text and "<XAI_Mock" not in text:
    text = text.replace(old_str, new_str)
elif "<XAI_Mock" not in text:
    # try another old str finding
    old_str = "leading-relaxed\">{result.message}</p>\n          </div>"
    new_str = old_str + "\n          <XAI_Mock result={result} />"
    text = text.replace(old_str, new_str)

with open('src/pages/RiskAssessmentPage.jsx', 'w', encoding='utf-8') as f:
    f.write(text)
