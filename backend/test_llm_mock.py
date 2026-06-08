import os
import unittest
from unittest.mock import patch, MagicMock
from app.services.llm_service import LLMService

class TestLLMServiceMock(unittest.TestCase):
    @patch('app.services.llm_service.httpx.Client')
    def test_groq_api_call(self, mock_client_class):
        # Setup mock client
        mock_client = MagicMock()
        mock_client_class.return_value.__enter__.return_value = mock_client
        
        # Setup mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": "<h2>Mock Response</h2><p>Here is some content without emojis.</p>"
                    }
                }
            ]
        }
        mock_client.post.return_value = mock_response
        
        # Test parameters
        context = {
            "income": 50000.0,
            "expenses": 20000.0,
            "savingsRate": 60.0,
            "cashFlow": 30000.0,
            "netWorth": 100000.0,
            "emergencyFundMonths": 5.0,
            "categoryBreakdown": {"Rent": 7000.0},
            "budgetOverruns": [],
            "recentTransactions": ["tx1"]
        }
        history = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hello user"}
        ]
        
        # Instantiate LLMService with keys
        os.environ["GROQ_API_KEY"] = "mock_groq_key"
        service = LLMService(context=context, history=history)
        
        # Trigger response
        reply = service.generate_response("Can I afford a laptop?", "affordability")
        
        # Verify call parameters
        mock_client.post.assert_called_once()
        args, kwargs = mock_client.post.call_args
        
        url = args[0]
        payload = kwargs.get("json", {})
        headers = kwargs.get("headers", {})
        
        self.assertEqual(url, "https://api.groq.com/openai/v1/chat/completions")
        self.assertEqual(headers.get("Authorization"), "Bearer mock_groq_key")
        self.assertEqual(headers.get("Content-Type"), "application/json")
        self.assertEqual(payload.get("model"), "llama-3.3-70b-versatile")
        self.assertEqual(payload.get("temperature"), 0.4)
        self.assertEqual(payload.get("max_tokens"), 600)
        self.assertEqual(payload.get("top_p"), 0.8)
        self.assertEqual(payload.get("frequency_penalty"), 0.4)
        self.assertEqual(payload.get("presence_penalty"), 0.1)
        
        # Check messages payload structure
        messages = payload.get("messages", [])
        self.assertGreater(len(messages), 2)
        self.assertEqual(messages[0]["role"], "system")
        self.assertIn("Role: Affordability Agent", messages[0]["content"])
        self.assertEqual(messages[1]["role"], "user")
        self.assertEqual(messages[1]["content"], "Hello")
        self.assertEqual(messages[2]["role"], "assistant")
        self.assertEqual(messages[2]["content"], "Hello user")
        
        # Check that response was returned and sanitized (stripping any formatting markers if present)
        self.assertIn("<h2>Mock Response</h2>", reply)
        print("Mock API test passed successfully!")

if __name__ == "__main__":
    unittest.main()
