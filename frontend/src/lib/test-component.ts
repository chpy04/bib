/**
 * Test component code used when VITE_TESTING_MODE=true.
 * Renders in the iframe without any API calls to verify React + Tailwind + shadcn.
 */
export const TEST_COMPONENT_CODE = `
export default function App() {
  const [count, setCount] = React.useState(0);
  return (
    <div className="p-6 font-sans">
      <h2 className="text-lg font-semibold mb-2">Iframe test — React + Tailwind + shadcn</h2>
      <p className="text-muted-foreground mb-4">Count: {count}</p>
      <div className="flex gap-2">
        <Button onClick={() => setCount(c => c + 1)}>Increment</Button>
        <Button variant="outline" onClick={() => setCount(0)}>Reset</Button>
      </div>
      <Card className="mt-4 max-w-sm">
        <CardHeader>
          <CardTitle>Card from shadcn</CardTitle>
          <CardDescription>If you see this, Tailwind and shadcn are working.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
`

export const TEST_SESSION_ID = 'test-session'
