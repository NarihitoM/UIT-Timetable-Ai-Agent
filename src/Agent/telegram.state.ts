import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

const Telegramagentstate = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
        default: () => []
    }),
    nextAgent: Annotation<string>({
        reducer: (x, y) => y ?? x, 
        default: () => "main_agent",
    })
})

export default Telegramagentstate;