import {VisuallyHidden, useSwitch} from "@heroui/react";
import { Icon } from '@iconify/react';

const SearchSwitch = (props) => {
  const {Component, slots, isSelected, getBaseProps, getInputProps, getWrapperProps} =
    useSwitch(props);

  return (
    <div className="flex flex-col gap-2">
      <Component {...getBaseProps()}>
        <VisuallyHidden>
          <input {...getInputProps()} />
        </VisuallyHidden>
        <div
          {...getWrapperProps()}
          className={slots.wrapper({
            class: [
              "w-8 h-8",
              "flex items-center justify-center",
              "rounded-lg bg-default-100 hover:bg-default-200",
            ],
          })}
        >
          {isSelected ? <Icon className="w-full h-full" icon="fluent:globe-search-20-filled" /> : <Icon className="w-full h-full" icon="fluent:globe-search-20-regular" />}
        </div>
      </Component>
    </div>
  );
};

export default SearchSwitch;