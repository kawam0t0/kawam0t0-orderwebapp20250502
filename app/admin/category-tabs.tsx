"use client"

import { Button } from "@/components/ui/button"

interface CategoryTabsProps {
  categories: string[]
  activeCategory: string
  onCategoryChange: (category: string) => void
}

export function CategoryTabs({ categories, activeCategory, onCategoryChange }: CategoryTabsProps) {
  return (
    <div className="flex space-x-2 mb-6">
      {categories.map((category) => (
        <Button
          key={category}
          variant={activeCategory === category ? "default" : "outline"}
          onClick={() => onCategoryChange(category)}
          className={activeCategory === category ? "bg-blue-600 text-white" : ""}
        >
          {category}
        </Button>
      ))}
    </div>
  )
}
