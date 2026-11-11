// Calls the MCP tool like Claude Code would. Usage: PKG_API_URL=http://127.0.0.1:3000 npx tsx test-client.ts npm lodahs
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const [ecosystem = 'npm', name = 'lodahs'] = process.argv.slice(2)
const transport = new StdioClientTransport({
  command: 'node_modules/.bin/tsx',
  args: ['server.ts'],
  env: { ...process.env, PKG_API_URL: process.env.PKG_API_URL ?? 'http://127.0.0.1:3000' } as Record<string, string>,
})
const client = new Client({ name: 'test-client', version: '0.0.1' })
await client.connect(transport)
console.log('tools:', (await client.listTools()).tools.map((t) => t.name).join(', '))
const res = await client.callTool({ name: 'check_package', arguments: { ecosystem, name } })
console.log((res.content as { text: string }[])[0].text)
await client.close()
