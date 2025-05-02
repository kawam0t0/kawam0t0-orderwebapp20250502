"use client"

import { Package } from "lucide-react"

interface CategoryTabsProps {
  categories: string[]
  activeCategory: string
  onCategoryChange: (category: string) => void
}

export function CategoryTabs({ categories, activeCategory, onCategoryChange }: CategoryTabsProps) {
  return (
    <div className="flex items-center px-6 py-4 border-b border-gray-200">
      <div className="flex items-center">
        <Package className="h-5 w-5 text-blue-500 mr-2" />
        <h2 className="text-lg font-medium text-gray-800">発注履歴</h2>
      </div>
    </div>
  )
}
