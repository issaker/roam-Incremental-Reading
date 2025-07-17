import * as Blueprint from '@blueprintjs/core';
import styled from '@emotion/styled';
import Tooltip from '~/components/Tooltip';
import { CompletionStatus, Today } from '~/models/practice';

const Wrapper = styled.span`
  display: flex;
`;

const Tag = styled(Blueprint.Tag)`
  &.bp3-tag {
    padding: 1px 3px;
    min-height: auto;
    min-width: auto;
  }
`;

interface SidePanelWidgetProps {
  onClickCallback: () => void;
  today: Today;
}
const SidePandelWidget = ({ onClickCallback, today }: SidePanelWidgetProps) => {
  const allDoneToday = today.combinedToday.status === CompletionStatus.Finished;
  const combinedCounts = today.combinedToday;

  const completed = combinedCounts.completed;
  const newCards = combinedCounts.new;
  const dueCards = combinedCounts.due;

  const iconClass = allDoneToday ? 'bp3-icon-confirm' : 'bp3-icon-box';

  return (
    <Wrapper
      data-testid="side-panel-wrapper"
      className="w-full justify-between"
      onClick={onClickCallback}
    >
      <div>
        <div className="flex items-center">
          <span className={`bp3-icon ${iconClass} icon bp3-icon-small mr-1`}></span>
          <div>Review</div>
        </div>
      </div>
      <div className="flex items-center ml-2">
        {newCards > 0 && (
          // @ts-ignore
          <Tooltip content="New Cards" placement="top">
            <Tag active minimal intent="success" className="text-center" data-testid="new-tag">
              {newCards}
            </Tag>
          </Tooltip>
        )}

        {dueCards > 0 && (
          // @ts-ignore
          <Tooltip content="Due Cards" placement="top">
            <Tag active minimal intent="primary" className="text-center mx-1" data-testid="due-tag">
              {dueCards}
            </Tag>
          </Tooltip>
        )}

        {completed > 0 && (
          // @ts-ignore
          <Tooltip content="Completed" placement="top">
            <Tag active minimal intent="none" className="text-center mx-1" data-testid="completed-tag" style={{ color: '#000', backgroundColor: '#f5f5f5', borderColor: '#ccc' }}>
              {completed}
            </Tag>
          </Tooltip>
        )}
      </div>
    </Wrapper>
  );
};

export default SidePandelWidget;
