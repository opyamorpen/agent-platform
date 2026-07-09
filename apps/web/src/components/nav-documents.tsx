import { Link, useLocation } from "react-router-dom"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavDocuments({
  label,
  items,
}: {
  label?: string
  items: {
    name: string
    url: string
    icon: React.ReactNode
  }[]
}) {
  const { pathname } = useLocation()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      {label ? <SidebarGroupLabel>{label}</SidebarGroupLabel> : null}
      <SidebarMenu>
        {items.map((item) => {
          const isActive = matchesNavigationPath(pathname, item.url)

          return (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={isActive}>
                <Link to={item.url}>
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

function matchesNavigationPath(pathname: string, url: string): boolean {
  return pathname === url || pathname.startsWith(`${url}/`)
}
