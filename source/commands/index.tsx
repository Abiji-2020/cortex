import {Text} from 'ink';
import zod from 'zod';

export const options = zod.object({
	name: zod.string().default('Stranger').describe('Name'),
});

type Props = {
	options: zod.infer<typeof options>;
};

export default function Index(props: Props) {
	const {options: userOptions} = props;
	return (
		<>
			<Text>
				Hello, <Text color="green">{userOptions.name}</Text>
			</Text>
		</>
	);
}
