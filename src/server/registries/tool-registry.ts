export type ToolDefinition = {
  name: string;
  description: string;
  status: "reserved" | "mocked" | "available";
};

export const toolRegistry: ToolDefinition[] = [
  {
    name: "file-reader",
    description: "Reserved MCP tool slot for reading files as task input.",
    status: "reserved"
  },
  {
    name: "document-generator",
    description: "Reserved MCP tool slot for generating structured documents.",
    status: "reserved"
  },
  {
    name: "data-analysis",
    description: "Reserved MCP tool slot for spreadsheet and data analysis tasks.",
    status: "reserved"
  }
];
