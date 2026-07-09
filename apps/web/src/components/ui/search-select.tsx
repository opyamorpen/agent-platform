"use client"

import * as React from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { useTranslation } from "react-i18next"

const DEFAULT_VISIBLE_OPTIONS_LIMIT = 50

function getMatchIndex(text: string, query: string): number {
  return text.toLowerCase().indexOf(query)
}

function buildOptionSearchText(
  option: SearchSelectOption,
  getCustomSearchText?: (option: SearchSelectOption) => string
): string {
  return getCustomSearchText
    ? getCustomSearchText(option)
    : [option.label, ...(option.keywords ?? [])].join(" ")
}

export type SearchSelectOption = {
  value: string
  label: string
  disabled?: boolean
  keywords?: string[]
}

type SearchSelectProps = {
  options: SearchSelectOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string | undefined, option?: SearchSelectOption) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  clearable?: boolean
  required?: boolean
  name?: string
  inputId?: string
  ariaLabel?: string
  portalContainer?: React.ComponentProps<typeof ComboboxContent>["container"]
  className?: string
  contentClassName?: string
  listClassName?: string
  visibleOptionsLimit?: number
  getOptionSearchText?: (option: SearchSelectOption) => string
  onInputValueChange?: (value: string) => void
}

function SearchSelect({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  emptyText,
  disabled = false,
  clearable = false,
  required = false,
  name,
  inputId,
  ariaLabel,
  portalContainer,
  className,
  contentClassName,
  listClassName,
  visibleOptionsLimit = DEFAULT_VISIBLE_OPTIONS_LIMIT,
  getOptionSearchText,
  onInputValueChange,
}: SearchSelectProps) {
  const { t } = useTranslation()
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const [open, setOpen] = React.useState(false)
  const selectedValue = value ?? uncontrolledValue

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === selectedValue),
    [options, selectedValue]
  )

  const [inputValue, setInputValue] = React.useState(selectedOption?.label ?? "")

  React.useEffect(() => {
    if (!open) {
      setInputValue(selectedOption?.label ?? "")
    }
  }, [open, selectedOption])

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
          // Prefix matches in the visible label should always win.
          labelPrefixRank: labelMatchIndex === 0 ? 0 : 1,
          // Matches earlier in the visible label should rank ahead of later matches.
          labelMatchRank: labelMatchIndex >= 0 ? labelMatchIndex : Number.MAX_SAFE_INTEGER,
          // Fall back to the broader search text (keywords, ids, etc.) when label tie-breaks.
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

  function handleValueChange(nextOption: SearchSelectOption | null) {
    const nextValue = nextOption?.value

    if (value === undefined) {
      setUncontrolledValue(nextValue)
    }

    setInputValue(nextOption?.label ?? "")
    onValueChange?.(nextValue, nextOption ?? undefined)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)

    if (!nextOpen) {
      setInputValue(selectedOption?.label ?? "")
    }
  }

  return (
    <Combobox<SearchSelectOption>
      items={options}
      value={selectedOption ?? null}
      onValueChange={(nextValue) => handleValueChange(nextValue as SearchSelectOption | null)}
      inputValue={inputValue}
      onInputValueChange={(nextInputValue) => {
        const nextValue = String(nextInputValue)
        setInputValue(nextValue)
        onInputValueChange?.(nextValue)
      }}
      open={open}
      onOpenChange={handleOpenChange}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      disabled={disabled}
      required={required}
      name={name}
      autoHighlight
    >
      <ComboboxInput
        className={className}
        placeholder={placeholder ?? t("searchSelect.placeholder")}
        disabled={disabled}
        showClear={clearable && Boolean(selectedValue || inputValue)}
        id={inputId}
        aria-label={ariaLabel}
      />
      <ComboboxContent className={contentClassName} container={portalContainer}>
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
                value: "__search-select-overflow__",
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

export { SearchSelect }
