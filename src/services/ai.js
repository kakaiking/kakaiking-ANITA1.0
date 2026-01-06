export class AIService {
    constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = "https://openrouter.ai/api/v1";
    }

    async chat(messages, onStream) {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/kakaiking/anita", // Optional
                "X-Title": "Anita IDE"
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages,
                stream: !!onStream
            })
        });

        if (onStream) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";
            let partialLine = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const text = partialLine + chunk;
                const lines = text.split("\n");
                partialLine = lines.pop();

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6).trim();
                        if (data === "[DONE]") continue;
                        try {
                            const json = JSON.parse(data);
                            const content = json.choices[0]?.delta?.content || "";
                            fullText += content;
                            onStream(content);
                        } catch (e) {
                            console.error("Error parsing stream", e);
                        }
                    }
                }
            }
            return fullText;
        } else {
            const data = await response.json();
            if (data.usage) {
                window.api.updateTokenUsage(data.usage.total_tokens);
            }
            return data.choices[0].message.content;
        }
    }
}
