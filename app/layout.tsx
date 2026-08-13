import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"Digital Graduation Guestbook",description:"A personal graduation memory space for Ngân.",other:{"codex-preview":"development"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="vi"><body>{children}</body></html>}
