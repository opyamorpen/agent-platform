"use client"

import * as React from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import { useTranslation } from "react-i18next"

const DEFAULT_VISIBLE_OPTIONS_LIMIT = 50

function getMatchIndex(text: string, query: string): number {
  return text.toLowerCase().indexOf(query)
}

function buildOptionSearchText(
  option: MultiSearchSelectOption,
  getCustomSearchText?: (option: MultiSearchSelectOption) => string
): string {
  return getCustomSearchText
    ? getCustomSearchText(option)
    : [option.label, ...(option.keywords ?? [])].join(" ")
}

export type MultiSearchSelectOption = {
  value: string
  label: string
  disabled?: boolean
  keywords?: string[]
}

type MultiSearchSelectProps = {
  options: MultiSearchSelectOption[]
  values?: string[]
  onValuesChange?: (values: string[], options: MultiSearchSelectOption[]) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  contentClassName?: string
  listClassName?: string
  portalContainer?: React.ComponentProps<typeof ComboboxContent>["container"]
  visibleOptionsLimit?: number
  getOptionSearchText?: (option: MultiSearchSelectOption) => string
  onInputValueChange?: (value: string) => void
}

function MultiSearchSelect({
  options,
  values = [],
  onValuesChange,
  placeholder,
  emptyText,
  disabled = false,
  className,
  contentClassName,
  listClassName,
  portalContainer,
  visibleOptionsLimit = DEFAULT_VISIBLE_OPTIONS_LIMIT,
  getOptionSearchText,
  onInputValueChange,
}: MultiSearchSelectProps) {
  const { t } = useTranslation()
  const anchor = useComboboxAnchor()
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const selectedOptions = React.useMemo(
    () => options.filter((option) => values.includes(option.value)),
    [options, values]
  )

  const filteredOptions = React.useMemo(() => {
    const query = inputValue.trim().toLowerCase()

    if (!query) {
      return options
    }

    return options
      .map((option, index) => {
        const labelMatchIndex = getMatchIndex(option.label, query)
        const searchText = buildOptionSearchText(option, getOptionSearchText)
        const searchMatchIndex = getMatchIndex(searchText, query)

        if (searchMatchIndex < 0) {
          return null
        }

        return {
          option,
          index,
          labelPrefixRank: labelMatchIndex === 0 ? 0 : 1,
          labelMatchRank: labelMatchIndex >= 0 ? labelMatchIndex : Number.MAX_SAFE_INTEGER,
          searchMatchRank: searchMatchIndex,
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((left, right) => {
        if (left.labelPrefixRank !== right.labelPrefixRank) {
          return left.labelPrefixRank - right.labelPrefixRank
        }

        if (left.labelMatchRank !== right.labelMatchRank) {
          return left.labelMatchRank - right.labelMatchRank
        }

        if (left.searchMatchRank !== right.searchMatchRank) {
          return left.searchMatchRank - right.searchMatchRank
        }

        return left.index - right.index
      })
      .map((entry) => entry.option)
  }, [getOptionSearchText, inputValue, options])

  const visibleOptions = React.useMemo(
    () => filteredOptions.slice(0, visibleOptionsLimit),
    [filteredOptions, visibleOptionsLimit]
  )

  const hasOverflow = filteredOptions.length > visibleOptionsLimit
  const overflowLabel = inputValue.trim()
    ? t("searchSelect.overflowFiltered", { count: visibleOptionsLimit })
    : t("searchSelect.overflowUnfiltered", { count: visibleOptionsLimit })

  function handleValueChange(nextValue: MultiSearchSelectOption[]) {
    const nextValues = nextValue.map((o) => o.value)
    onValuesChange?.(nextValues, nextValue)
  }

  return (
    <Combobox<MultiSearchSelectOption, true>
      multiple
      items={options}
      value={selectedOptions}
      onValueChange={(nextValue) => handleValueChange(nextValue as MultiSearchSelectOption[])}
      inputValue={inputValue}
      onInputValueChange={(nextInputValue) => {
        const nextValue = String(nextInputValue)
        setInputValue(nextValue)
        onInputValueChange?.(nextValue)
      }}
      open={open}
      onOpenChange={setOpen}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      disabled={disabled}
      autoHighlight
    >
      <div ref={anchor} className={className}>
        <ComboboxChips>
          {selectedOptions.map((option) => (
            <ComboboxChip key={option.value}>
              {option.label}
            </ComboboxChip>
          ))}
          <ComboboxChipsInput
            placeholder={
              selectedOptions.length === 0
                ? (placeholder ?? t("searchSelect.placeholder"))
                : ""
            }
          />
        </ComboboxChips>
      </div>
      <ComboboxContent className={contentClassName} container={portalContainer} anchor={anchor}>
        <ComboboxEmpty>{emptyText ?? t("searchSelect.empty")}</ComboboxEmpty>
        <ComboboxList className={listClassName}>
          {visibleOptions.map((option) => (
            <ComboboxItem key={option.value} value={option} disabled={option.disabled}>
              {option.label}
            </ComboboxItem>
          ))}
          {hasOverflow && (
            <ComboboxItem
              value={{
                value: "__multi-search-select-overflow__",
                label: overflowLabel,
                disabled: true,
              }}
              disabled
            >
              <span className="text-muted-foreground">{overflowLabel}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

export { MultiSearchSelect }
