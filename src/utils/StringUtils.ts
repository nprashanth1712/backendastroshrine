const toString = (obj: any): string => {
  return (
    "[" +
    Object.entries(obj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ") +
    "]"
  );
};

function removeSpecialCharacters(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, "");
}

export { toString, removeSpecialCharacters };
