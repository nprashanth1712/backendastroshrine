import tracer from 'tracer';

function getLogger()  {
  const logLevel = process.env.LOG_LEVEL as number | "log";
  return tracer.colorConsole({ level: logLevel });
}

export default getLogger;