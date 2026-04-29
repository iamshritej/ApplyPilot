type JsonSchema = {
  type: "object";
  additionalProperties?: boolean;
  required?: string[];
  properties: Record<string, unknown>;
};

const OPENAI_BASE_URL = "https://api.openai.com/v1";

export function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL || "gpt-5.2";
}

export async function callOpenAIJson<T>(input: {
  system: string;
  user: string;
  schema: JsonSchema;
  schemaName: string;
}) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: getOpenAIModel(),
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: input.system
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: input.user
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: input.schemaName,
          schema: input.schema,
          strict: true
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const outputText = getOutputText(data);
  if (!outputText) {
    return null;
  }

  return JSON.parse(outputText) as T;
}

export async function embedTexts(texts: string[]) {
  if (!process.env.OPENAI_API_KEY || texts.length === 0) {
    return null;
  }

  const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      input: texts.map((text) => text.slice(0, 8000))
    })
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };

  const embeddings = data.data?.map((item) => item.embedding ?? []) ?? [];
  return embeddings.length === texts.length ? embeddings : null;
}

function getOutputText(data: Record<string, unknown>) {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  const output = data.output;
  if (!Array.isArray(output)) {
    return "";
  }

  const chunks: string[] = [];
  for (const item of output as Array<Record<string, unknown>>) {
    const content = item.content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content as Array<Record<string, unknown>>) {
      if (typeof part.text === "string") {
        chunks.push(part.text);
      }
      if (typeof part.output_text === "string") {
        chunks.push(part.output_text);
      }
    }
  }

  return chunks.join("\n").trim();
}
