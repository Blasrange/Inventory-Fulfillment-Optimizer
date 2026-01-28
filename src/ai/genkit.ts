import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import "dotenv/config";

export const ai = genkit({
  plugins: [googleAI()],
});
