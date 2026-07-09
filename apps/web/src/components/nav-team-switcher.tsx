import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useTeamContext } from "@/layouts/app-layout"
import { ChevronsUpDownIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

export function NavTeamSwitcher() {
  const { t } = useTranslation()
  const { isMobile } = useSidebar()
  const {
    teams,
    selectedTeam,
    selectedTeamUUID,
    setSelectedTeamUUID,
    isLoading,
    errorMessage,
  } = useTeamContext()

  const fallbackLabel = isLoading
    ? t("teamSwitcher.loading")
    : errorMessage
      ? t("teamSwitcher.error")
      : t("teamSwitcher.empty")

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <span className="truncate font-medium">
                {selectedTeam?.name ?? fallbackLabel}
              </span>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel>{t("teamSwitcher.label")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {teams.length > 0 ? (
              teams.map((team) => {
                return (
                  <DropdownMenuItem
                    key={team.uuid}
                    onClick={() => setSelectedTeamUUID(team.uuid)}
                  >
                    <span className="truncate">{team.name}</span>
                  </DropdownMenuItem>
                )
              })
            ) : (
              <DropdownMenuItem disabled>{fallbackLabel}</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
