import React from "react";
import {
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Row,
  UncontrolledButtonDropdown,
  UncontrolledDropdown,
  Button
} from "reactstrap";
import { Link, useHistory, useLocation } from "react-router-dom";

import { isAccepted } from "../../utils";
import { formatMomentDate, parseSecond } from "../../utils/DateUtil";
import MergedProblem from "../../interfaces/MergedProblem";
import Contest from "../../interfaces/Contest";
import Submission from "../../interfaces/Submission";
import SmallTable from "./SmallTable";
import DifficultyTable from "./DifficultyTable";
import ButtonGroup from "reactstrap/lib/ButtonGroup";
import { noneStatus, ProblemId, ProblemStatus } from "../../interfaces/Status";
import { List, Map, Range, Set } from "immutable";
import ProblemModel from "../../interfaces/ProblemModel";
import { DifficultyCircle } from "../../components/DifficultyCircle";
import { ListTable } from "./ListTable";
import { connect, PromiseState } from "react-refetch";
import * as CachedApiClient from "../../utils/CachedApiClient";
import { RatingInfo } from "../../utils/RatingInfo";
import { generatePathWithParams } from "../../utils/QueryString";

export const INF_POINT = 1e18;

export interface ProblemRowData {
  readonly id: string;
  readonly title: string;
  readonly contest?: Contest;
  readonly contestDate: string;
  readonly contestTitle: string;
  readonly lastAcceptedDate: string;
  readonly solverCount: number;
  readonly point: number;
  readonly problemModel?: ProblemModel;
  readonly firstUserId: string;
  readonly executionTime: number;
  readonly codeLength: number;
  readonly mergedProblem: MergedProblem;
  readonly shortestUserId: string;
  readonly fastestUserId: string;
  readonly status: ProblemStatus;
}

const statusFilters = ["All", "Only Trying", "Only AC"] as const;
type StatusFilter = typeof statusFilters[number];
const convertToValidStatusFilterState = (
  value: string | null
): StatusFilter => {
  for (const filter of statusFilters) {
    if (value === filter) {
      return value;
    }
  }

  return "All";
};

const RATED_FILTERS = ["All", "Only Rated", "Only Unrated"] as const;
type RatedFilter = typeof RATED_FILTERS[number];
const convertToValidRatedFilter = (value: string | null): RatedFilter => {
  for (const filter of RATED_FILTERS) {
    if (value === filter) {
      return value;
    }
  }

  return "All";
};
const FilterParams = {
  FromPoint: "fromPo",
  ToPoint: "toPo",
  Status: "status",
  Rated: "rated",
  FromDifficulty: "fromDiff",
  ToDifficulty: "toDiff"
} as const;

const InnerListPage = (props: InnerProps) => {
  const location = useLocation();
  const history = useHistory();
  const searchParams = new URLSearchParams(location.search);

  const fromPoint = parseInt(
    searchParams.get(FilterParams.FromPoint) || "0",
    10
  );
  const toPoint = parseInt(
    searchParams.get(FilterParams.ToPoint) || INF_POINT.toString(),
    10
  );
  const setExactPointFilter = (point: number) => {
    const params = new URLSearchParams(location.search);
    params.set(FilterParams.FromPoint, point.toString());
    params.set(FilterParams.ToPoint, point.toString());
    history.push({ ...location, search: params.toString() });
  };
  const statusFilterState: StatusFilter = convertToValidStatusFilterState(
    searchParams.get(FilterParams.Status)
  );
  const ratedFilterState: RatedFilter = convertToValidRatedFilter(
    searchParams.get(FilterParams.Rated)
  );
  const fromDifficulty = parseInt(
    searchParams.get(FilterParams.FromDifficulty) || "-1",
    10
  );
  const toDifficulty: number = parseInt(
    searchParams.get(FilterParams.ToDifficulty) || INF_POINT.toString(),
    10
  );
  const setDifficultyFilter = (from: number, to: number) => {
    const params = new URLSearchParams(location.search);
    params.set(FilterParams.FromDifficulty, from.toString());
    params.set(FilterParams.ToDifficulty, to.toString());
    history.push({ ...location, search: params.toString() });
  };

  const {
    mergedProblemsFetch,
    problemModelsFetch,
    submissionsFetch,
    userId,
    rivals,
    contestsFetch,
    statusLabelMapFetch,
    userRatingInfoFetch
  } = props;

  const mergedProblems = mergedProblemsFetch.fulfilled
    ? mergedProblemsFetch.value
    : Map<ProblemId, MergedProblem>();
  const contests = contestsFetch.fulfilled
    ? contestsFetch.value
    : Map<string, Contest>();
  const problemModels = problemModelsFetch.fulfilled
    ? problemModelsFetch.value
    : Map<ProblemId, ProblemModel>();
  const submissions = submissionsFetch.fulfilled
    ? submissionsFetch.value
    : Map<ProblemId, List<Submission>>();
  const statusLabelMap = statusLabelMapFetch.fulfilled
    ? statusLabelMapFetch.value
    : Map<ProblemId, ProblemStatus>();

  const userInternalRating = userRatingInfoFetch.fulfilled
    ? userRatingInfoFetch.value.internalRating
    : null;

  const rowData = mergedProblems
    .valueSeq()
    .map(
      (p): ProblemRowData => {
        const contest = contests.get(p.contest_id);
        const contestDate = contest
          ? formatMomentDate(parseSecond(contest.start_epoch_second))
          : "";
        const contestTitle = contest ? contest.title : "";

        const lastSubmission = submissions
          .get(p.id, List<Submission>())
          .filter(s => s.user_id === userId)
          .filter(s => isAccepted(s.result))
          .maxBy(s => s.epoch_second);
        const lastAcceptedDate = lastSubmission
          ? formatMomentDate(parseSecond(lastSubmission.epoch_second))
          : "";
        const point = p.point ? p.point : p.predict ? p.predict : INF_POINT;
        const firstUserId = p.first_user_id ? p.first_user_id : "";
        const executionTime =
          p.execution_time != null ? p.execution_time : INF_POINT;
        const codeLength = p.source_code_length
          ? p.source_code_length
          : INF_POINT;
        const shortestUserId = p.shortest_user_id ? p.shortest_user_id : "";
        const fastestUserId = p.fastest_user_id ? p.fastest_user_id : "";
        const problemModel = problemModels.get(p.id);
        return {
          id: p.id,
          title: p.title,
          contest,
          contestDate,
          contestTitle,
          lastAcceptedDate,
          solverCount: p.solver_count ? p.solver_count : 0,
          point,
          problemModel,
          firstUserId,
          executionTime,
          codeLength,
          mergedProblem: p,
          shortestUserId,
          fastestUserId,
          status: statusLabelMap.get(p.id, noneStatus())
        };
      }
    )
    .sort((a, b) => {
      const dateOrder = b.contestDate.localeCompare(a.contestDate);
      return dateOrder === 0 ? a.title.localeCompare(b.title) : dateOrder;
    })
    .toList();
  const points = mergedProblems
    .valueSeq()
    .map(p => p.point)
    .reduce((set, point) => (point ? set.add(point) : set), Set<number>())
    .toList()
    .sort();
  const difficulties = Range(0, 4400, 400)
    .map(from => ({
      from,
      to: from === 4000 ? INF_POINT : from + 399
    }))
    .toList();

  return (
    <div>
      <Row className="my-2 border-bottom">
        <h1>Point Status</h1>
      </Row>
      <Row>
        <SmallTable
          mergedProblems={mergedProblems}
          submissions={submissions}
          userIds={rivals.insert(0, userId)}
          setFilterFunc={setExactPointFilter}
        />
      </Row>

      <Row className="my-2 border-bottom">
        <h1>Difficulty Status</h1>
      </Row>
      <Row>
        <DifficultyTable
          mergedProblems={mergedProblems}
          submissions={submissions}
          userIds={rivals.insert(0, userId)}
          problemModels={problemModels}
          setFilterFunc={setDifficultyFilter}
        />
      </Row>

      <Row className="my-2 border-bottom">
        <h1>Problem List</h1>
      </Row>
      <Row>
        <ButtonGroup className="mr-4">
          <UncontrolledButtonDropdown>
            <DropdownToggle caret>
              {fromPoint === 0 ? "Point From" : fromPoint}
            </DropdownToggle>
            <DropdownMenu>
              {points.map(p => (
                <DropdownItem
                  key={p}
                  tag={Link}
                  to={generatePathWithParams(location, {
                    [FilterParams.FromPoint]: p.toString()
                  })}
                >
                  {p}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </UncontrolledButtonDropdown>
          <UncontrolledButtonDropdown>
            <DropdownToggle caret>
              {toPoint === INF_POINT ? "Point To" : toPoint}
            </DropdownToggle>
            <DropdownMenu>
              {points.map(p => (
                <DropdownItem
                  key={p}
                  tag={Link}
                  to={generatePathWithParams(location, {
                    [FilterParams.ToPoint]: p.toString()
                  })}
                >
                  {p}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </UncontrolledButtonDropdown>
        </ButtonGroup>
        <ButtonGroup className="mr-4">
          <UncontrolledDropdown>
            <DropdownToggle caret>{statusFilterState}</DropdownToggle>
            <DropdownMenu>
              {statusFilters.map(status => (
                <DropdownItem
                  key={status}
                  tag={Link}
                  to={generatePathWithParams(location, {
                    [FilterParams.Status]: status
                  })}
                >
                  {status}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </UncontrolledDropdown>
        </ButtonGroup>
        <ButtonGroup className="mr-4">
          <UncontrolledDropdown>
            <DropdownToggle caret>{ratedFilterState}</DropdownToggle>
            <DropdownMenu>
              {RATED_FILTERS.map(value => (
                <DropdownItem
                  key={value}
                  tag={Link}
                  to={generatePathWithParams(location, {
                    [FilterParams.Rated]: value
                  })}
                >
                  {value}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </UncontrolledDropdown>
        </ButtonGroup>

        <ButtonGroup className="mr-4">
          <UncontrolledButtonDropdown>
            <DropdownToggle caret>
              {fromDifficulty === -1
                ? "Difficulty From"
                : `${fromDifficulty} - `}
            </DropdownToggle>
            <DropdownMenu>
              {difficulties.map(({ from, to }) => (
                <DropdownItem
                  key={from}
                  tag={Link}
                  to={generatePathWithParams(location, {
                    [FilterParams.FromDifficulty]: from.toString()
                  })}
                >
                  <DifficultyCircle
                    difficulty={to}
                    id={`from-difficulty-dropdown-${to}`}
                  />
                  {from} -
                </DropdownItem>
              ))}
            </DropdownMenu>
          </UncontrolledButtonDropdown>
          <UncontrolledButtonDropdown>
            <DropdownToggle caret>
              {toDifficulty === INF_POINT
                ? "Difficulty To"
                : ` - ${toDifficulty}`}
            </DropdownToggle>
            <DropdownMenu>
              {difficulties.map(({ to }) => (
                <DropdownItem
                  key={to}
                  tag={Link}
                  to={generatePathWithParams(location, {
                    [FilterParams.FromDifficulty]:
                      fromDifficulty !== -1 ? fromDifficulty.toString() : "0",
                    [FilterParams.ToDifficulty]: to.toString()
                  })}
                >
                  <DifficultyCircle
                    difficulty={to}
                    id={`from-difficulty-dropdown-${to}`}
                  />
                  - {to < INF_POINT ? to : "inf"}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </UncontrolledButtonDropdown>
        </ButtonGroup>
        <Button
          outline
          color="danger"
          onClick={() => history.push({ ...location, search: "" })}
        >
          Reset
        </Button>
      </Row>
      <Row>
        <ListTable
          fromPoint={fromPoint}
          toPoint={toPoint}
          statusFilterState={statusFilterState}
          ratedFilterState={ratedFilterState}
          fromDifficulty={fromDifficulty}
          toDifficulty={toDifficulty}
          rowData={rowData}
          userInternalRating={userInternalRating}
        />
      </Row>
    </div>
  );
};

interface OuterProps {
  readonly userId: string;
  readonly rivals: List<string>;
}

interface InnerProps extends OuterProps {
  readonly submissionsFetch: PromiseState<Map<ProblemId, List<Submission>>>;
  readonly mergedProblemsFetch: PromiseState<Map<ProblemId, MergedProblem>>;
  readonly problemModelsFetch: PromiseState<Map<ProblemId, ProblemModel>>;
  readonly contestsFetch: PromiseState<Map<string, Contest>>;
  readonly statusLabelMapFetch: PromiseState<Map<ProblemId, ProblemStatus>>;
  readonly userRatingInfoFetch: PromiseState<RatingInfo>;
}

export const ListPage = connect<OuterProps, InnerProps>(props => ({
  submissionsFetch: {
    comparison: [props.userId, props.rivals],
    value: () =>
      CachedApiClient.cachedUsersSubmissionMap(props.rivals.push(props.userId))
  },
  mergedProblemsFetch: {
    comparison: null,
    value: () => CachedApiClient.cachedMergedProblemMap()
  },
  problemModelsFetch: {
    comparison: null,
    value: () => CachedApiClient.cachedProblemModels()
  },
  contestsFetch: {
    comparison: null,
    value: () => CachedApiClient.cachedContestMap()
  },
  statusLabelMapFetch: {
    comparison: [props.userId, props.rivals],
    value: () =>
      CachedApiClient.cachedStatusLabelMap(props.userId, props.rivals)
  },
  userRatingInfoFetch: {
    comparison: props.userId,
    value: () => CachedApiClient.cachedRatingInfo(props.userId)
  }
}))(InnerListPage);
