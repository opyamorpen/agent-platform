import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useTranslation } from "react-i18next"

export function NavUser({
  user,
}: {
  user: {
    name: string
  }
}) {
  const { t } = useTranslation()
  const initial = user.name.trim().charAt(0).toUpperCase() || "?"
  const accessibleName = user.name || t("common.fallback.currentUser")

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent active:bg-transparent">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-medium">{accessibleName}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
