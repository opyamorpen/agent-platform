"use client"

import * as React from "react"

const FloatingLayerContext = React.createContext<HTMLElement | null>(null)

function FloatingLayerProvider({
  container,
  children,
}: {
  container: HTMLElement | null
  children: React.ReactNode
}) {
  return (
    <FloatingLayerContext.Provider value={container}>
      {children}
    </FloatingLayerContext.Provider>
  )
}

function useFloatingLayerContainer() {
  return React.useContext(FloatingLayerContext)
}

const FloatingLayerRoot = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-slot="floating-layer-root"
      className={className}
      {...props}
    />
  )
})

FloatingLayerRoot.displayName = "FloatingLayerRoot"

export {
  FloatingLayerProvider,
  FloatingLayerRoot,
  useFloatingLayerContainer,
}
