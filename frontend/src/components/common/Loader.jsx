import PropTypes from "prop-types";

const Loader = ({ fullScreen = false, size = "md", text = "Loading..." }) => {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-3",
    lg: "h-12 w-12 border-4",
  };

  const containerClasses = fullScreen
    ? "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm"
    : "flex flex-col items-center justify-center p-8";

  return (
    <div className={containerClasses}>
      <div
        className={`
        ${sizes[size]} 
        rounded-full 
        border-gray-200 
        border-t-primary 
        animate-spin
      `}
      ></div>
      {text && (
        <p
          className={`mt-4 font-medium text-gray-600 dark:text-gray-300 ${size === "lg" ? "text-lg" : "text-sm"}`}
        >
          {text}
        </p>
      )}
    </div>
  );
};

Loader.propTypes = {
  fullScreen: PropTypes.bool,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
  text: PropTypes.string,
};

export default Loader;
