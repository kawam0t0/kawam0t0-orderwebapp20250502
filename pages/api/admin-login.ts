import type { NextApiRequest, NextApiResponse } from "next"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { email, password } = req.body

    if (email === "admin@admin.com" && password === "admin") {
      res.status(200).json({ message: "Admin login successful" })
    } else {
      res.status(401).json({ message: "Invalid admin credentials" })
    }
  } else {
    res.setHeader("Allow", ["POST"])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  }
}

