import os
import httpx
import json
import re
from typing import List, Dict, Any, Optional
import time

class LLMService:
    def __init__(self, context: Dict[str, Any], history: Optional[List[Dict[str, str]]] = None):
        self.context = context
        self.history = history or []
        self.groq_key = os.environ.get("GROQ_API_KEY")
        self.openai_key = os.environ.get("OPENAI_API_KEY")
        self.anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
        self.gemini_key = os.environ.get("GEMINI_API_KEY")

    def _get_history_messages(self, query: str) -> List[Dict[str, str]]:
        clean_history = []
        for msg in self.history:
            if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
                continue
            clean_history.append(msg)
            
        # Deduplicate the active query if it is already present at the end of the history
        if clean_history and clean_history[-1]["role"] == "user" and clean_history[-1]["content"].strip() == query.strip():
            clean_history = clean_history[:-1]
            
        return clean_history

    def build_system_prompt(self, agent_type: str) -> str:
        base_instructions = (
            "You are a Chartered Financial Planner (CFP) and Personal Finance Advisor specialising in spending optimisation, "
            "savings growth, budget control, and financial risk management. You must adhere to the following rules:\n"
            "RULE 0 — Data Anchoring (CRITICAL): The Financial Context JSON supplied with every query contains the user's "
            "REAL financial data from their personal finance database. You MUST cite specific numbers — amounts in ₹, "
            "utilisation percentages, category names, account balances, and health sub-scores — directly from this JSON. "
            "Never invent or estimate values. If a figure is not in the context, say 'data not available' for that metric.\n"
            "RULE 1 — Output format: Output raw HTML only (e.g. <h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <strong>). "
            "NEVER use markdown syntax (**, ###, or markdown tables).\n"
            "RULE 2 — Speed & Conciseness: No long introductions, greetings, or conclusions. Begin immediately with the response structure.\n"
            "RULE 3 — Required Structure:\n"
            "   <h2>Summary</h2>\n"
            "   <p>[2-4 sentences referencing the user's actual figures from the context JSON.]</p>\n"
            "   <h2>Key Insights</h2>\n"
            "   <ul>\n"
            "     <li>[Data-backed insight 1 — cite ₹ amounts or % from context]</li>\n"
            "     <li>[Data-backed insight 2]</li>\n"
            "     <li>[Data-backed insight 3]</li>\n"
            "   </ul>\n"
            "   <h2>Recommendations</h2>\n"
            "   <ol>\n"
            "     <li>[Specific, actionable step with ₹ targets or % benchmarks]</li>\n"
            "     <li>[Specific, actionable step]</li>\n"
            "     <li>[Specific, actionable step]</li>\n"
            "   </ol>\n"
            "   Include these optional sections ONLY when directly relevant:\n"
            "   - <h2>Budget Risk Analysis</h2> (for categories at Warning/Critical utilisation)\n"
            "   - <h2>Savings Projection</h2> (with milestone timeline in months)\n"
            "   - <h2>Financial Impact</h2> (for affordability or salary-change queries)\n"
            "   - <h2>Next Steps</h2> (maximum 3 numbered action items)\n"
            "RULE 4 — No Generic Advice: Every recommendation must reference actual data from the supplied context. "
            "No motivational fluff, no repeated disclaimers, no generic finance education unless explicitly asked.\n"
            "RULE 5 — Readability: Paragraphs ≤3 lines. Wrap all key figures in <strong> tags. "
            "Use HTML tables ONLY for side-by-side numerical comparisons.\n"
            "RULE 6 — Memory: On follow-up questions, do not repeat the full previous analysis. "
            "Reference prior context briefly then answer the new question only.\n"
            "RULE 7 — Quality: No duplicate sentences, no repeated financial metrics, no repeated recommendations."
        )

        agent_prompts = {
            "health": (
                "Role: Financial Health Diagnostics Agent. Maximum length: 300 words.\n"
                "Task: Report the user's exact total health score and each of the 5 sub-scores "
                "(savings_score, budget_discipline_score, cash_flow_score, spending_stability_score, emergency_fund_score) "
                "from the health_components section of the context. Label the strongest and weakest component. "
                "Provide a phased 3-step improvement roadmap with specific ₹ targets or % thresholds. "
                "Forecast the score after implementing the roadmap."
            ),
            "cfo": (
                "Role: Chief Financial Officer (CFO) Agent. Maximum length: 450 words.\n"
                "Task: Deliver an executive-style monthly audit. Include an HTML table with: "
                "Monthly Income, Total Expenses, Net Surplus, Savings Rate %, and Financial Health Score. "
                "Reference dashboard_intelligence.top_financial_strength and biggest_financial_weakness. "
                "List all budget_analysis entries with risk_level=Critical or Warning with their utilisation_pct. "
                "Conclude with 3 prioritised action items using figures from the context."
            ),
            "budget": (
                "Role: Budget Control Agent. Maximum length: 350 words.\n"
                "Task: Analyse every entry in budget_analysis. Produce an HTML table showing: "
                "Category | Budget Limit | Spent | Remaining | Utilisation % | Risk Level. "
                "Explain root causes for Critical or Warning items. "
                "Recommend specific ₹ reductions per category to restore Healthy status (<70% utilisation)."
            ),
            "savings": (
                "Role: Savings Optimisation Agent. Maximum length: 400 words.\n"
                "Task: Use monthly_pnl.savings and savings_rate_pct as the baseline. "
                "Reference savings_projection.months_to_1lakh_emergency. "
                "Identify the top 2 discretionary categories from spending_intelligence.top_categories that can be trimmed. "
                "Compare standard vs accelerated (+15% surplus) savings timelines in an HTML table. "
                "Use dashboard_intelligence.best_savings_opportunity as the lead recommendation."
            ),
            "affordability": (
                "Role: Affordability Evaluation Agent. Maximum length: 350 words.\n"
                "Task: Evaluate the purchase using account_summary.total_balance, monthly_pnl.cash_flow, "
                "and health_components.emergency_fund_label from the context. "
                "Categorise as: Strongly Affordable / Affordable / Borderline / Not Recommended. "
                "Show: impact on liquid balance, months of emergency fund coverage lost, and "
                "opportunity cost at 10% annual return over 1, 3, and 5 years in a compact HTML table."
            ),
            "master": (
                "Role: Master Financial Advisor. Maximum length: 350 words.\n"
                "Task: Answer general finance queries, salary increase scenarios, or context-aware follow-ups. "
                "Always ground answers in the user's actual context figures. "
                "Reference trend_analysis for MoM changes when relevant."
            ),
        }

        agent_prompt = agent_prompts.get(agent_type, agent_prompts["master"])
        return f"{base_instructions}\n\n{agent_prompt}"

    def _trim_context_for_prompt(self) -> str:
        """
        Serialise context to JSON. If it exceeds 5 500 chars, progressively
        remove verbose sub-sections to stay within a safe token budget.
        """
        import json as _json
        ctx = dict(self.context)
        serialised = _json.dumps(ctx, ensure_ascii=False)
        if len(serialised) <= 5500:
            return serialised

        # Step 1: trim recent_transactions to 10
        if "recent_transactions" in ctx:
            ctx["recent_transactions"] = ctx["recent_transactions"][:10]

        serialised = _json.dumps(ctx, ensure_ascii=False)
        if len(serialised) <= 5500:
            return serialised

        # Step 2: trim category_trends to 5
        if "trend_analysis" in ctx and "category_trends" in ctx["trend_analysis"]:
            ctx["trend_analysis"]["category_trends"] = ctx["trend_analysis"]["category_trends"][:5]

        serialised = _json.dumps(ctx, ensure_ascii=False)
        if len(serialised) <= 5500:
            return serialised

        # Step 3: drop account-level detail
        if "account_summary" in ctx and "accounts" in ctx["account_summary"]:
            del ctx["account_summary"]["accounts"]

        return _json.dumps(ctx, ensure_ascii=False)

    def generate_response(self, user_query: str, agent_type: str) -> str:
        provider_name = "None"
        model_name = "None"
        fallback_used = True
        response = None

        # 1. Try Groq
        if self.groq_key:
            response = self._call_groq(user_query, agent_type)
            if response:
                provider_name = "Groq"
                model_name = "llama-3.3-70b-versatile"
                fallback_used = False

        # 2. Try OpenAI
        if not response and self.openai_key:
            response = self._call_openai(user_query, agent_type)
            if response:
                provider_name = "OpenAI"
                model_name = "gpt-4o"
                fallback_used = False

        # 3. Try Gemini
        if not response and self.gemini_key:
            response = self._call_gemini(user_query, agent_type)
            if response:
                provider_name = "Google Gemini"
                model_name = "gemini-2.5-flash"
                fallback_used = False

        # 4. Try Anthropic
        if not response and self.anthropic_key:
            response = self._call_anthropic(user_query, agent_type)
            if response:
                provider_name = "Anthropic"
                model_name = "claude-3-5-sonnet"
                fallback_used = False

        # Fallback
        if not response:
            response = self._generate_local_fallback(user_query, agent_type)
            provider_name = "Local Fallback"
            model_name = "Deterministic Template"
            fallback_used = True

        # ── Extended debug log ───────────────────────────────────────────
        import json as _json
        ctx_str      = _json.dumps(self.context, ensure_ascii=False)
        health_comps = self.context.get("health_components", {})
        print("════════════════ ADVISOR DEBUG LOG ════════════════", flush=True)
        print(f"  Agent Type      : {agent_type}", flush=True)
        print(f"  LLM Provider    : {provider_name}", flush=True)
        print(f"  Model Used      : {model_name}", flush=True)
        print(f"  Temperature     : 0.4 | Top-P: 0.8 | Max Tokens: 1200", flush=True)
        print(f"  History Msgs    : {len(self._get_history_messages(user_query))}", flush=True)
        print(f"  Context Size    : {len(ctx_str):,} chars", flush=True)
        print(f"  Financial Score : {health_comps.get('total_score', 'N/A')}/100", flush=True)
        print(
            f"  Score Breakdown : Savings={health_comps.get('savings_score', '?')} | "
            f"Budget={health_comps.get('budget_discipline_score', '?')} | "
            f"CashFlow={health_comps.get('cash_flow_score', '?')} | "
            f"Stability={health_comps.get('spending_stability_score', '?')} | "
            f"Emergency={health_comps.get('emergency_fund_score', '?')}",
            flush=True
        )
        print(f"  Fallback Used   : {str(fallback_used).upper()}", flush=True)
        print("═══════════════════════════════════════════════════", flush=True)

        return self._sanitize_response(response)

    def _call_groq(self, query: str, agent_type: str) -> Optional[str]:
        url = "https://api.groq.com/openai/v1/chat/completions"
        retries = 4
        wait_times = [0, 1, 2, 4]

        context_json = self._trim_context_for_prompt()

        for attempt in range(retries):
            delay = wait_times[attempt]
            if delay > 0:
                print(f"GROQ Retry: Waiting {delay}s before Attempt {attempt + 1}...", flush=True)
                time.sleep(delay)

            print(f"GROQ Request Attempt {attempt + 1}: model=llama-3.3-70b-versatile", flush=True)
            try:
                headers = {
                    "Authorization": f"Bearer {self.groq_key}",
                    "Content-Type": "application/json",
                }
                messages = [{"role": "system", "content": self.build_system_prompt(agent_type)}]
                for msg in self._get_history_messages(query):
                    messages.append({"role": msg["role"], "content": msg["content"]})
                messages.append({
                    "role": "user",
                    "content": f"User query: {query}\n\nFinancial Context: {context_json}",
                })

                payload = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": messages,
                    "temperature": 0.4,
                    "top_p": 0.8,
                    "frequency_penalty": 0.4,
                    "presence_penalty": 0.1,
                    "max_tokens": 1200,
                }
                with httpx.Client(timeout=15.0) as client:
                    res = client.post(url, json=payload, headers=headers)
                    print(f"GROQ Response Status: {res.status_code}", flush=True)
                    if res.status_code == 200:
                        return res.json()["choices"][0]["message"]["content"]
                    else:
                        print(f"GROQ Response Body (Non-200): {res.text}", flush=True)
            except Exception as e:
                print(f"GROQ ERROR on attempt {attempt + 1}: {str(e)}", flush=True)
        return None

    def _call_openai(self, query: str, agent_type: str) -> Optional[str]:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            context_json = self._trim_context_for_prompt()
            headers = {
                "Authorization": f"Bearer {self.openai_key}",
                "Content-Type": "application/json",
            }
            messages = [{"role": "system", "content": self.build_system_prompt(agent_type)}]
            for msg in self._get_history_messages(query):
                messages.append({"role": msg["role"], "content": msg["content"]})
            messages.append({
                "role": "user",
                "content": f"User query: {query}\n\nFinancial Context: {context_json}",
            })

            payload = {
                "model": "gpt-4o",
                "messages": messages,
                "temperature": 0.4,
                "top_p": 0.8,
                "frequency_penalty": 0.4,
                "presence_penalty": 0.1,
                "max_tokens": 1200,
            }
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    return res.json()["choices"][0]["message"]["content"]
        except Exception:
            pass
        return None

    def _call_anthropic(self, query: str, agent_type: str) -> Optional[str]:
        try:
            url = "https://api.anthropic.com/v1/messages"
            context_json = self._trim_context_for_prompt()
            headers = {
                "x-api-key": self.anthropic_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            }
            messages = []
            for msg in self._get_history_messages(query):
                messages.append({"role": msg["role"], "content": msg["content"]})
            messages.append({
                "role": "user",
                "content": f"User query: {query}\n\nFinancial Context: {context_json}",
            })

            payload = {
                "model": "claude-3-5-sonnet-20241022",
                "system": self.build_system_prompt(agent_type),
                "messages": messages,
                "max_tokens": 1200,
                "temperature": 0.4,
                "top_p": 0.8,
            }
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    return res.json()["content"][0]["text"]
        except Exception:
            pass
        return None

    def _call_gemini(self, query: str, agent_type: str) -> Optional[str]:
        try:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"gemini-2.5-flash:generateContent?key={self.gemini_key}"
            )
            context_json = self._trim_context_for_prompt()
            headers = {"Content-Type": "application/json"}

            contents = []
            contents.append({
                "role": "user",
                "parts": [{"text": f"System Guidelines: {self.build_system_prompt(agent_type)}"}],
            })
            contents.append({
                "role": "model",
                "parts": [{"text": "Understood. I will act as the designated CFP agent, output only valid HTML, cite real ₹ figures from the context, and omit all emojis."}],
            })
            for msg in self._get_history_messages(query):
                role = "model" if msg["role"] == "assistant" else "user"
                contents.append({"role": role, "parts": [{"text": msg["content"]}]})
            contents.append({
                "role": "user",
                "parts": [{"text": f"User query: {query}\n\nFinancial Context: {context_json}"}],
            })

            payload = {
                "contents": contents,
                "generationConfig": {
                    "temperature": 0.4,
                    "topP": 0.8,
                    "frequencyPenalty": 0.4,
                    "presencePenalty": 0.1,
                    "maxOutputTokens": 1200,
                },
            }
            with httpx.Client(timeout=15.0) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    return res.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            pass
        return None

    def _sanitize_response(self, text: str) -> str:
        clean = text
        if "```html" in clean:
            clean = clean.split("```html")[1].split("```")[0]
        elif "```" in clean:
            clean = clean.split("```")[1].split("```")[0]
            
        emoji_pattern = re.compile(
            "["
            "\U0001f600-\U0001f64f|"
            "\U0001f300-\U0001f5ff|"
            "\U0001f680-\U0001f6ff|"
            "\U0001f1e0-\U0001f1ff|"
            "\u2700-\u27bf|"
            "\u2600-\u26ff"
            "]+", flags=re.UNICODE
        )
        clean = emoji_pattern.sub("", clean)
        
        clean = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', clean)
        clean = re.sub(r'### (.*?)(\n|$)', r'<h3>\1</h3>', clean)
        clean = re.sub(r'## (.*?)(\n|$)', r'<h2>\1</h2>', clean)
        
        # Output Quality Control: Deduplicate sentences and list items/recommendations
        clean = self._remove_duplicates(clean)
        
        return clean.strip()

    def _remove_duplicates(self, text: str) -> str:
        def normalize_text(val: str) -> str:
            # Strip HTML tags
            val_no_html = re.sub(r'<[^>]+>', '', val)
            # Lowercase
            val_lower = val_no_html.lower()
            # Keep only alphanumeric
            val_clean = re.sub(r'[^a-z0-9]', '', val_lower)
            return val_clean.strip()

        lines = text.split('\n')
        seen_lines = set()
        unique_lines = []
        for line in lines:
            line_stripped = line.strip()
            if not line_stripped:
                unique_lines.append(line)
                continue
                
            norm = normalize_text(line_stripped)
            if norm:
                if norm in seen_lines:
                    continue
                seen_lines.add(norm)
                
            unique_lines.append(line)
            
        text = '\n'.join(unique_lines)
        
        def clean_paragraph_sentences(paragraph: str) -> str:
            if "<table" in paragraph or "<thead" in paragraph or "<tbody" in paragraph or "<tr" in paragraph:
                return paragraph
            
            sentences = re.split(r'(?<=[.!?])\s+', paragraph)
            seen_sentences = set()
            unique_sentences = []
            for s in sentences:
                s_strip = s.strip()
                if not s_strip:
                    continue
                norm = normalize_text(s_strip)
                if len(norm) > 12:
                    if norm in seen_sentences:
                        continue
                    seen_sentences.add(norm)
                unique_sentences.append(s)
            return " ".join(unique_sentences)

        final_lines = []
        for line in text.split('\n'):
            if ("<p>" in line or "<li>" in line) and not ("<ul" in line or "<ol" in line):
                final_lines.append(clean_paragraph_sentences(line))
            else:
                final_lines.append(line)
                
        return '\n'.join(final_lines)

    def _generate_local_fallback(self, query: str, agent_type: str) -> str:
        income = self.context.get("income", 50000.0)
        expenses = self.context.get("expenses", 20000.0)
        savings_rate = self.context.get("savingsRate", 0.0)
        score = self.context.get("financialHealthScore", 70)
        liquid_balance = self.context.get("liquidBalance", 0.0)
        net_worth = self.context.get("netWorth", 0.0)
        
        if score >= 80:
            grade = "A"
        elif score >= 65:
            grade = "B"
        elif score >= 50:
            grade = "C"
        else:
            grade = "F"

        if agent_type == "health":
            return (
                "<h2>Financial Health Report</h2>"
                f"<p>Overall Score: {score}/100</p>"
                "<h3>Diagnostics</h3>"
                "<ul>"
                f"<li>Savings rate: {savings_rate:.1f}% credit allocation efficiency</li>"
                "<li>Income stability coefficient classified as consistent</li>"
                f"<li>Emergency fund timeline ratio: {liquid_balance / (expenses or 20000):.1f} months</li>"
                "</ul>"
            )
            
        elif agent_type == "cfo":
            surplus = max(0, income - expenses)
            return (
                "<h2>Chief Financial Officer Audit</h2>"
                "<h3>Executive Summary</h3>"
                f"<p>Financial Grade: Grade {grade} | Performance Score: {score}/100</p>"
                "<h3>Core Statements</h3>"
                "<table class=\"w-full text-left border-collapse mt-2\">"
                "<thead>"
                "<tr class=\"border-b border-slate-800 text-[10px] text-slate-500 uppercase font-bold\">"
                "<th class=\"pb-2\">Metric</th>"
                "<th class=\"pb-2\">Value</th>"
                "</tr>"
                "</thead>"
                "<tbody class=\"divide-y divide-slate-800/40 text-xs\">"
                f"<tr><td class=\"py-2 text-slate-400\">Monthly Revenue</td><td class=\"py-2 font-bold text-slate-200\">INR {income:,.2f}</td></tr>"
                f"<tr><td class=\"py-2 text-slate-400\">Total Outlays</td><td class=\"py-2 font-bold text-slate-200\">INR {expenses:,.2f}</td></tr>"
                f"<tr><td class=\"py-2 text-slate-400\">Net Capital Surplus</td><td class=\"py-2 font-bold text-emerald-400\">INR {surplus:,.2f}</td></tr>"
                "</tbody>"
                "</table>"
            )
            
        elif agent_type == "budget":
            return (
                "<h2>Category Budget Allocation</h2>"
                "<h3>Recommended Targets</h3>"
                "<table class=\"w-full text-left border-collapse mt-2\">"
                "<thead>"
                "<tr class=\"border-b border-slate-800 text-[10px] text-slate-500 uppercase font-bold\">"
                "<th class=\"pb-2\">Group</th>"
                "<th class=\"pb-2\">Cap Limit</th>"
                "</tr>"
                "</thead>"
                "<tbody class=\"divide-y divide-slate-800/40 text-xs\">"
                f"<tr><td class=\"py-2 text-slate-400\">Fixed Needs (50%)</td><td class=\"py-2 font-bold text-slate-200\">INR {income*0.5:,.0f}</td></tr>"
                f"<tr><td class=\"py-2 text-slate-400\">Variable Wants (30%)</td><td class=\"py-2 font-bold text-slate-200\">INR {income*0.3:,.0f}</td></tr>"
                f"<tr><td class=\"py-2 text-slate-400\">Savings allocation (20%)</td><td class=\"py-2 font-bold text-emerald-400\">INR {income*0.2:,.0f}</td></tr>"
                "</tbody>"
                "</table>"
            )
            
        elif agent_type == "savings":
            surplus = max(1000, income - expenses)
            target = 150000.0
            months = (target - liquid_balance) / surplus if target > liquid_balance else 0
            months_text = f"{max(1, int(round(months)))} months" if months > 0 else "Fully Funded"
            return (
                "<h2>Savings Strategy</h2>"
                "<h3>Capital Reserves Overview</h3>"
                "<ul>"
                f"<li>Liquid Balances: INR {liquid_balance:,.2f}</li>"
                f"<li>Total Net Worth: INR {net_worth:,.2f}</li>"
                f"<li>Suggested monthly savings surplus contribution: INR {surplus:,.2f}</li>"
                f"<li>Months to reach emergency fund target (INR {target:,.0f}): <strong>{months_text}</strong></li>"
                "</ul>"
            )
            
        elif agent_type == "affordability":
            import re
            numbers = re.findall(r'\d[\d,\.]*', query)
            cost = 120000.0
            if numbers:
                try:
                    cost = float(numbers[0].replace(',', ''))
                except ValueError:
                    pass
            surplus = max(0, income - expenses)
            ratio = (cost / net_worth) * 100 if net_worth > 0 else 100
            
            if cost <= net_worth * 0.15:
                verdict = f"Affordable. This purchase represents {ratio:.1f}% of net worth."
            else:
                verdict = f"Unfeasible. This purchase consumes {ratio:.1f}% of your net worth and creates cash flow stress."
                
            return (
                "<h2>Affordability Review</h2>"
                f"<p>{verdict}</p>"
                "<h3>Impact Details</h3>"
                "<ul>"
                f"<li>Surplus runway: INR {surplus:,.2f}</li>"
                f"<li>Monthly cost if financed (12 months): INR {cost/12:,.2f}</li>"
                "</ul>"
            )
            
        else:
            return (
                "<h2>Personal Finance Advisor Review</h2>"
                f"<p>Advisor diagnostic index score: {score}/100</p>"
                "<p>Ask about specific purchases, cash flow indicators, or run a CFO audit report.</p>"
            )
