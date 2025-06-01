import type { RequestEvent } from '@sveltejs/kit';

export const load = async ({ params }: RequestEvent) => {
	return {
		userId: params.userId
	};
};



