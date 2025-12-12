"use client";

import { CalendarIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DateRangePickerProps {
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  placeholder = "Pick a date range",
  className,
  disabled = false,
}: DateRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !dateRange && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateRange?.from ? (
            dateRange.to ? (
              <>
                {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
              </>
            ) : (
              format(dateRange.from, "LLL dd, y")
            )
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="center"
        side="bottom"
        sideOffset={8}
        avoidCollisions={true}
      >
        <Calendar
          mode="range"
          defaultMonth={dateRange?.from}
          selected={dateRange}
          onSelect={onDateRangeChange}
          numberOfMonths={2}
          classNames={{
            caption_label: "text-sm font-medium",
            month_caption: "flex justify-center pt-1 relative items-center h-10 mb-2",
            nav: "space-x-1 flex items-center",
            button_previous: cn(
              buttonVariants({ variant: "outline" }),
              "absolute left-1 top-1 h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 z-10 cursor-pointer"
            ),
            button_next: cn(
              buttonVariants({ variant: "outline" }),
              "absolute right-1 top-1 h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 z-10 cursor-pointer"
            ),
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
