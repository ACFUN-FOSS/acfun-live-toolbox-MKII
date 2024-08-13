export const register = (name: string, callback: Function) => {
	const es = new EventSource(
		`${
			process.env.NODE_ENV != "production" ? "http://localhost:1299" : ""
		}/api/messagers/register?name=${name}`
	);
};
