import WelcomePage from "./WelcomeContent"

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  return (
    <WelcomePage
      autoOpenLogin={params.login === "1"}
      autoOpenSignup={params.signup === "1"}
    />
  )
}
